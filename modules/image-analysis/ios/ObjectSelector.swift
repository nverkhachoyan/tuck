import Accelerate
import CoreImage
import ExpoModulesCore
import Foundation
import ImageIO
import onnxruntime_objc

/// Segment Anything (MobileSAM), for selecting any object under a tap or in
/// a box, as `mobileSamWorker.js` does on web: the encoder reads one image,
/// once, and the decoder answers each prompt from what it read. Not thread-safe: the
/// module calls it from one queue.
final class ObjectSelector {
	/// The encoder's input is this square, with the image at its top left,
	/// resized to fill its width or height.
	private static let side = 1024
	/// ImageNet's mean, which the encoder subtracts, so padding with it
	/// reads as nothing, as the encoder's own padding would.
	private static let mean: [Float] = [123.675, 116.28, 103.53]
	/// Masks whose areas are this close to a smaller one's add nothing to grow to.
	private static let sameArea = 0.05
	/// How much steeper than its sigmoid a mask's coverage rises across its
	/// edge. A box's mask can be unsure all through (logits under 3 inside),
	/// and at its sigmoid an object taken out after being added left a ghost
	/// of itself.
	private static let sharpness: Float = 8
	/// Small-box crop re-encoding parameters, matching `objectCrop.ts`.
	private static let cropPad = 0.1
	private static let maxCropShare = 0.5
	private static let minCropPixels = 16.0
	private static let refinedMaskMaxSide = 2048

	private struct CropPlan {
		let outputWidth: Int
		let outputHeight: Int
		let pasteX: Int
		let pasteY: Int
		let pasteWidth: Int
		let pasteHeight: Int
		let sourceRect: CGRect
		let encodeWidth: Int
		let encodeHeight: Int
		let promptBox: (left: Float, top: Float, right: Float, bottom: Float)
	}

	private let env: ORTEnv
	private var sessions: (encoder: ORTSession, decoder: ORTSession)?
	private var encoded: (uri: URL, embeddings: ORTValue, width: Int, height: Int, sourceWidth: Int, sourceHeight: Int)?

	init() throws {
		env = try ORTEnv(loggingLevel: .warning)
	}

	/// Reads the image at `uri` for taps, replacing the one read before.
	func prepare(_ uri: URL) throws {
		if encoded?.uri == uri { return }
		encoded = nil
		let image = try Self.encoderInput(uri)
		let input = try ORTValue(
			tensorData: image.pixels,
			elementType: .float,
			shape: [Self.side, Self.side, 3].map { NSNumber(value: $0) }
		)
		let output = try loadSessions().encoder.run(
			withInputs: ["input_image": input],
			outputNames: ["image_embeddings"],
			runOptions: nil
		)
		guard let embeddings = output["image_embeddings"] else {
			throw ObjectSelectionException("The encoder returned nothing")
		}
		encoded = (uri, embeddings, image.width, image.height, image.sourceWidth, image.sourceHeight)
		// The decoder's first run sets up much of what later runs reuse.
		_ = try decode(
			embeddings: embeddings,
			outputWidth: image.width,
			outputHeight: image.height,
			prompt: Self.point(x: Float(image.width) / 2, y: Float(image.height) / 2)
		)
	}

	/// Masks of the object `prompt` points at, from a part to the whole, or
	/// boxes, just the one, in the image at `uri`, as grayscale PNG files, or
	/// nil while that image isn't read.
	func masks(_ uri: URL, for prompt: ObjectPromptRecord) throws -> ObjectMasksRecord? {
		guard let encoded, encoded.uri == uri else { return nil }
		if let box = prompt.box,
			let plan = Self.planCrop(sourceWidth: encoded.sourceWidth, sourceHeight: encoded.sourceHeight, box: box),
			let refined = try refinedBoxMask(uri: uri, plan: plan)
		{
			return ObjectMasksRecord(masks: [refined], likeliest: 0)
		}
		let (width, height) = (Float(encoded.width), Float(encoded.height))
		let decoderPrompt: (coords: [Float], labels: [Float])
		if let box = prompt.box {
			decoderPrompt = Self.box(
				left: Float(box.x) * width,
				top: Float(box.y) * height,
				right: Float(box.x + box.width) * width,
				bottom: Float(box.y + box.height) * height
			)
		} else if let point = prompt.point {
			decoderPrompt = Self.point(x: Float(point.x) * width, y: Float(point.y) * height)
		} else {
			throw ObjectSelectionException("A prompt needs a point or a box")
		}
		let output = try decode(
			embeddings: encoded.embeddings,
			outputWidth: encoded.width,
			outputHeight: encoded.height,
			prompt: decoderPrompt
		)
		return try Self.masks(output, width: encoded.width, height: encoded.height, boxed: prompt.box != nil)
	}

	/// A point, and the padding point the decoder expects without a box.
	private static func point(x: Float, y: Float) -> (coords: [Float], labels: [Float]) {
		([x, y, 0, 0], [1, -1])
	}

	/// A box, as its top left and bottom right corners, labelled as SAM's are.
	private static func box(left: Float, top: Float, right: Float, bottom: Float) -> (coords: [Float], labels: [Float]) {
		([left, top, right, bottom], [2, 3])
	}

	/// The decoder's masks as PNG files, smallest first. The first output is
	/// the single mask it gives when told not to guess, which the others
	/// cover: a box, which says which object it means, gets that one alone,
	/// and a point the others.
	private static func masks(_ output: [String: ORTValue], width: Int, height: Int, boxed: Bool) throws -> ObjectMasksRecord {
		guard let logitData = try output["masks"]?.tensorData(),
			let scoreData = try output["iou_predictions"]?.tensorData()
		else {
			throw ObjectSelectionException("The decoder returned nothing")
		}
		let logits = logitData.bytes.assumingMemoryBound(to: Float.self)
		let scores = scoreData.bytes.assumingMemoryBound(to: Float.self)
		let size = width * height
		let count = logitData.length / MemoryLayout<Float>.size / size
		var masks: [(values: [UInt8], area: Int, score: Float)] = []
		for index in boxed ? 0..<1 : 1..<count {
			let mask = coverage(logits + index * size, count: size)
			if mask.area > 0 { masks.append((mask.values, mask.area, scores[index])) }
		}
		masks.sort { $0.area < $1.area }
		let distinct = masks.indices.filter { index in
			index == 0 || Double(masks[index].area) > Double(masks[index - 1].area) * (1 + sameArea)
		}.map { masks[$0] }
		var likeliest = 0
		for (index, mask) in distinct.enumerated() where mask.score > distinct[likeliest].score {
			likeliest = index
		}
		return ObjectMasksRecord(
			masks: try distinct.map { try writePng($0.values, width: width, height: height) },
			likeliest: likeliest
		)
	}

	/// A mask's logits as coverage from 0 to 255 (their sigmoid, steepened by
	/// `sharpness`, so edges stay soft), and how many say the object is there.
	private static func coverage(_ logits: UnsafePointer<Float>, count: Int) -> (values: [UInt8], area: Int) {
		let length = vDSP_Length(count)
		var zero: Float = 0
		var one: Float = 1
		var minusSharpness: Float = -sharpness
		var full: Float = 255
		var n = Int32(count)
		var area = 0
		var values = [UInt8](repeating: 0, count: count)
		var floats = [Float](repeating: 0, count: count)
		floats.withUnsafeMutableBufferPointer { buffer in
			let floats = buffer.baseAddress!
			// 1 where the logit is at least 0, -1 elsewhere.
			vDSP_vlim(logits, 1, &zero, &one, floats, 1, length)
			var sum: Float = 0
			vDSP_sve(floats, 1, &sum, length)
			area = Int((sum + Float(count)) / 2)
			vDSP_vsmul(logits, 1, &minusSharpness, floats, 1, length)
			vvexpf(floats, floats, &n)
			vDSP_vsadd(floats, 1, &one, floats, 1, length)
			vDSP_svdiv(&full, floats, 1, floats, 1, length)
			vDSP_vfixu8(floats, 1, &values, 1, length)
		}
		return (values, area)
	}

	func release() {
		encoded = nil
		sessions = nil
	}

	private func refinedBoxMask(uri: URL, plan: CropPlan) throws -> SubjectMaskRecord? {
		let pixels = try Self.cropEncoderInput(
			uri,
			sourceRect: plan.sourceRect,
			encodeWidth: plan.encodeWidth,
			encodeHeight: plan.encodeHeight
		)
		let input = try ORTValue(
			tensorData: pixels,
			elementType: .float,
			shape: [Self.side, Self.side, 3].map { NSNumber(value: $0) }
		)
		let encoderOutput = try loadSessions().encoder.run(
			withInputs: ["input_image": input],
			outputNames: ["image_embeddings"],
			runOptions: nil
		)
		guard let cropEmbeddings = encoderOutput["image_embeddings"] else {
			throw ObjectSelectionException("The encoder returned nothing")
		}
		let output = try decode(
			embeddings: cropEmbeddings,
			outputWidth: plan.pasteWidth,
			outputHeight: plan.pasteHeight,
			prompt: Self.box(
				left: plan.promptBox.left,
				top: plan.promptBox.top,
				right: plan.promptBox.right,
				bottom: plan.promptBox.bottom
			)
		)
		guard let logitData = try output["masks"]?.tensorData() else {
			throw ObjectSelectionException("The decoder returned nothing")
		}
		let logits = logitData.bytes.assumingMemoryBound(to: Float.self)
		let pasteSize = plan.pasteWidth * plan.pasteHeight
		let mask = Self.coverage(logits, count: pasteSize)
		guard mask.area > 0 else { return nil }
		var full = [UInt8](repeating: 0, count: plan.outputWidth * plan.outputHeight)
		mask.values.withUnsafeBufferPointer { src in
			full.withUnsafeMutableBufferPointer { dst in
				for row in 0..<plan.pasteHeight {
					let srcStart = src.baseAddress! + row * plan.pasteWidth
					let dstStart = dst.baseAddress! + (plan.pasteY + row) * plan.outputWidth + plan.pasteX
					dstStart.update(from: srcStart, count: plan.pasteWidth)
				}
			}
		}
		return try Self.writePng(full, width: plan.outputWidth, height: plan.outputHeight)
	}

	private static func planCrop(sourceWidth: Int, sourceHeight: Int, box: RectRecord) -> CropPlan? {
		guard sourceWidth > 0, sourceHeight > 0, box.width > 0, box.height > 0 else { return nil }
		let srcW = Double(sourceWidth)
		let srcH = Double(sourceHeight)
		let boxLeft = box.x * srcW
		let boxTop = box.y * srcH
		let boxWidth = box.width * srcW
		let boxHeight = box.height * srcH
		let pad = max(boxWidth, boxHeight) * cropPad

		let leftPx = min(srcW, max(0, boxLeft - pad))
		let topPx = min(srcH, max(0, boxTop - pad))
		let rightPx = min(srcW, max(0, boxLeft + boxWidth + pad))
		let bottomPx = min(srcH, max(0, boxTop + boxHeight + pad))

		let rawWidth = rightPx - leftPx
		let rawHeight = bottomPx - topPx
		let sourceLong = max(srcW, srcH)
		let cropLong = max(rawWidth, rawHeight)
		guard cropLong >= minCropPixels, cropLong / sourceLong <= maxCropShare else { return nil }

		let outScale = min(1.0, Double(refinedMaskMaxSide) / sourceLong)
		let outWidth = max(1, Int((srcW * outScale).rounded()))
		let outHeight = max(1, Int((srcH * outScale).rounded()))

		let pasteX = min(outWidth - 1, max(0, Int(floor((leftPx / srcW) * Double(outWidth)))))
		let pasteY = min(outHeight - 1, max(0, Int(floor((topPx / srcH) * Double(outHeight)))))
		let pasteRight = min(outWidth, max(pasteX + 1, Int(ceil((rightPx / srcW) * Double(outWidth)))))
		let pasteBottom = min(outHeight, max(pasteY + 1, Int(ceil((bottomPx / srcH) * Double(outHeight)))))
		let pasteWidth = pasteRight - pasteX
		let pasteHeight = pasteBottom - pasteY

		let normLeft = Double(pasteX) / Double(outWidth)
		let normTop = Double(pasteY) / Double(outHeight)
		let normWidth = Double(pasteWidth) / Double(outWidth)
		let normHeight = Double(pasteHeight) / Double(outHeight)

		let sourceRect = CGRect(
			x: normLeft * srcW,
			y: normTop * srcH,
			width: normWidth * srcW,
			height: normHeight * srcH
		)
		let encScale = Double(side) / max(sourceRect.width, sourceRect.height)
		let encodeWidth = max(1, Int((sourceRect.width * encScale).rounded()))
		let encodeHeight = max(1, Int((sourceRect.height * encScale).rounded()))

		func clamp01(_ value: Double) -> Double { min(1.0, max(0.0, value)) }
		let bx0 = Float(clamp01((box.x - normLeft) / normWidth) * Double(encodeWidth))
		let by0 = Float(clamp01((box.y - normTop) / normHeight) * Double(encodeHeight))
		let bx1 = Float(clamp01((box.x + box.width - normLeft) / normWidth) * Double(encodeWidth))
		let by1 = Float(clamp01((box.y + box.height - normTop) / normHeight) * Double(encodeHeight))

		return CropPlan(
			outputWidth: outWidth,
			outputHeight: outHeight,
			pasteX: pasteX,
			pasteY: pasteY,
			pasteWidth: pasteWidth,
			pasteHeight: pasteHeight,
			sourceRect: sourceRect,
			encodeWidth: encodeWidth,
			encodeHeight: encodeHeight,
			promptBox: (bx0, by0, bx1, by1)
		)
	}

	private func decode(
		embeddings: ORTValue,
		outputWidth: Int,
		outputHeight: Int,
		prompt: (coords: [Float], labels: [Float])
	) throws -> [String: ORTValue] {
		func tensor(_ values: [Float], _ shape: [Int]) throws -> ORTValue {
			try ORTValue(
				tensorData: NSMutableData(bytes: values, length: values.count * MemoryLayout<Float>.size),
				elementType: .float,
				shape: shape.map { NSNumber(value: $0) }
			)
		}
		return try loadSessions().decoder.run(
			withInputs: [
				"image_embeddings": embeddings,
				"point_coords": try tensor(prompt.coords, [1, prompt.labels.count, 2]),
				"point_labels": try tensor(prompt.labels, [1, prompt.labels.count]),
				"mask_input": try tensor([Float](repeating: 0, count: 256 * 256), [1, 1, 256, 256]),
				"has_mask_input": try tensor([0], [1]),
				"orig_im_size": try tensor([Float(outputHeight), Float(outputWidth)], [2]),
			],
			outputNames: ["masks", "iou_predictions"],
			runOptions: nil
		)
	}

	private func loadSessions() throws -> (encoder: ORTSession, decoder: ORTSession) {
		if let sessions { return sessions }
		guard let models = Bundle(for: ObjectSelector.self).url(forResource: "MobileSAM", withExtension: "bundle")
			.flatMap(Bundle.init(url:))
		else {
			throw ObjectSelectionException("The models aren't in the app")
		}
		func path(_ name: String) throws -> String {
			guard let path = models.path(forResource: name, ofType: "onnx") else {
				throw ObjectSelectionException("\(name) isn't in the app")
			}
			return path
		}
		// Core ML compiles the model the first time, which takes seconds, and
		// keeps it under the model's COREML_CACHE_KEY for the next. The GPU
		// ran it fastest: the Neural Engine took a second more to load it and
		// ran it at a third of the speed.
		let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
			.appendingPathComponent("mobile-sam", isDirectory: true)
		try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
		let encoderOptions = try ORTSessionOptions()
		try encoderOptions.appendCoreMLExecutionProvider(withOptionsV2: [
			"ModelFormat": "MLProgram",
			"MLComputeUnits": "CPUAndGPU",
			"ModelCacheDirectory": cache.path,
		])
		// The decoder's sizes change with each image, which Core ML can't take.
		let decoderOptions = try ORTSessionOptions()
		let loaded = (
			encoder: try ORTSession(
				env: env,
				modelPath: try path("mobile_sam_image_encoder"),
				sessionOptions: encoderOptions
			),
			decoder: try ORTSession(
				env: env,
				modelPath: try path("sam_mask_decoder_multi"),
				sessionOptions: decoderOptions
			)
		)
		sessions = loaded
		return loaded
	}

	/// The image at `uri`, upright and resized to the encoder's side on its
	/// longer side, as floats from 0 to 255 in RGB order, padded to a square.
	private static func encoderInput(_ uri: URL) throws -> (pixels: NSMutableData, width: Int, height: Int, sourceWidth: Int, sourceHeight: Int) {
		let image = try SourceImage(url: uri)
		let scale = Double(side) / max(image.width, image.height)
		let width = max(1, Int((image.width * scale).rounded()))
		let height = max(1, Int((image.height * scale).rounded()))
		guard let source = CGImageSourceCreateWithURL(uri as CFURL, nil),
			let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
				kCGImageSourceCreateThumbnailFromImageAlways: true,
				kCGImageSourceCreateThumbnailWithTransform: true,
				kCGImageSourceThumbnailMaxPixelSize: side,
			] as CFDictionary),
			let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
			let context = CGContext(
				data: nil,
				width: width,
				height: height,
				bitsPerComponent: 8,
				bytesPerRow: width * 4,
				space: colorSpace,
				bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
			)
		else {
			throw UnreadableImageException(uri.absoluteString)
		}
		// A smaller image is scaled up here, as on web.
		context.interpolationQuality = .high
		context.draw(thumbnail, in: CGRect(x: 0, y: 0, width: width, height: height))
		guard let rgba = context.data?.assumingMemoryBound(to: UInt8.self) else {
			throw UnreadableImageException(uri.absoluteString)
		}
		return (rgbaToTensor(rgba, width: width, height: height), width, height, Int(image.width), Int(image.height))
	}

	/// Crops `sourceRect` from the full-resolution upright image at `uri` and
	/// scales it into the encoder's square tensor.
	private static func cropEncoderInput(
		_ uri: URL,
		sourceRect: CGRect,
		encodeWidth: Int,
		encodeHeight: Int
	) throws -> NSMutableData {
		let image = try SourceImage(url: uri)
		let srcW = Int(image.width)
		let srcH = Int(image.height)
		let rx = max(0, min(srcW - 1, Int(floor(sourceRect.minX))))
		let ry = max(0, min(srcH - 1, Int(floor(sourceRect.minY))))
		let rx2 = max(rx + 1, min(srcW, Int(ceil(sourceRect.maxX))))
		let ry2 = max(ry + 1, min(srcH, Int(ceil(sourceRect.maxY))))
		let intCrop = CGRect(x: rx, y: ry, width: rx2 - rx, height: ry2 - ry)

		let cropped: CGImage
		if image.orientation == .up {
			guard let sub = image.cgImage.cropping(to: intCrop) else {
				throw UnreadableImageException(uri.absoluteString)
			}
			cropped = sub
		} else {
			let oriented = CIImage(cgImage: image.cgImage).oriented(image.orientation)
			let ciRect = CGRect(
				x: oriented.extent.minX + intCrop.minX,
				y: oriented.extent.minY + image.height - intCrop.maxY,
				width: intCrop.width,
				height: intCrop.height
			)
			let ciContext = CIContext(options: [.workingColorSpace: NSNull()])
			guard let rendered = ciContext.createCGImage(oriented, from: ciRect) else {
				throw UnreadableImageException(uri.absoluteString)
			}
			cropped = rendered
		}

		guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
			let context = CGContext(
				data: nil,
				width: encodeWidth,
				height: encodeHeight,
				bitsPerComponent: 8,
				bytesPerRow: encodeWidth * 4,
				space: colorSpace,
				bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
			)
		else {
			throw UnreadableImageException(uri.absoluteString)
		}
		context.interpolationQuality = .high
		let scaleX = CGFloat(encodeWidth) / sourceRect.width
		let scaleY = CGFloat(encodeHeight) / sourceRect.height
		let drawRect = CGRect(
			x: (intCrop.minX - sourceRect.minX) * scaleX,
			y: (sourceRect.maxY - intCrop.maxY) * scaleY,
			width: intCrop.width * scaleX,
			height: intCrop.height * scaleY
		)
		context.draw(cropped, in: drawRect)
		guard let rgba = context.data?.assumingMemoryBound(to: UInt8.self) else {
			throw UnreadableImageException(uri.absoluteString)
		}
		return rgbaToTensor(rgba, width: encodeWidth, height: encodeHeight)
	}

	private static func rgbaToTensor(_ rgba: UnsafePointer<UInt8>, width: Int, height: Int) -> NSMutableData {
		let pixels = NSMutableData(length: side * side * 3 * MemoryLayout<Float>.size)!
		let floats = pixels.mutableBytes.assumingMemoryBound(to: Float.self)
		for channel in 0..<3 {
			var value = mean[channel]
			vDSP_vfill(&value, floats + channel, 3, vDSP_Length(side * side))
			for row in 0..<height {
				vDSP_vfltu8(rgba + row * width * 4 + channel, 4, floats + row * side * 3 + channel, 3, vDSP_Length(width))
			}
		}
		return pixels
	}

	private static func writePng(_ values: [UInt8], width: Int, height: Int) throws -> SubjectMaskRecord {
		let file = FileManager.default.temporaryDirectory
			.appendingPathComponent("object-\(UUID().uuidString).png")
		guard let provider = CGDataProvider(data: Data(values) as CFData),
			let image = CGImage(
				width: width,
				height: height,
				bitsPerComponent: 8,
				bitsPerPixel: 8,
				bytesPerRow: width,
				space: CGColorSpaceCreateDeviceGray(),
				bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
				provider: provider,
				decode: nil,
				shouldInterpolate: false,
				intent: .defaultIntent
			),
			let destination = CGImageDestinationCreateWithURL(file as CFURL, "public.png" as CFString, 1, nil)
		else {
			throw ObjectSelectionException("Couldn't write a mask")
		}
		CGImageDestinationAddImage(destination, image, nil)
		guard CGImageDestinationFinalize(destination) else {
			throw ObjectSelectionException("Couldn't write a mask")
		}
		return SubjectMaskRecord(uri: file.absoluteString, width: Double(width), height: Double(height))
	}
}

/// A point on an object or a box around it, as fractions of the image.
struct ObjectPromptRecord: Record {
	@Field var point: PointRecord?
	@Field var box: RectRecord?
}

struct ObjectMasksRecord: Record {
	@Field var masks: [SubjectMaskRecord] = []
	@Field var likeliest: Int = 0

	init() {}

	init(masks: [SubjectMaskRecord], likeliest: Int) {
		self.masks = masks
		self.likeliest = likeliest
	}
}

final class ObjectSelectionException: GenericException<String>, @unchecked Sendable {
	override var reason: String {
		"Couldn't select objects: \(param)"
	}
}
