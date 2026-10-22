import Accelerate
import ExpoModulesCore
import Foundation
import ImageIO
import onnxruntime_objc

/// Segment Anything (MobileSAM), for selecting any object under a tap, as
/// `mobileSamWorker.js` does on web: the encoder reads one image, once, and
/// the decoder answers each tap from what it read. Not thread-safe: the
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

	private let env: ORTEnv
	private var sessions: (encoder: ORTSession, decoder: ORTSession)?
	private var encoded: (uri: URL, embeddings: ORTValue, width: Int, height: Int)?

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
		encoded = (uri, embeddings, image.width, image.height)
		// The decoder's first run sets up much of what later runs reuse.
		_ = try decode(x: Float(image.width) / 2, y: Float(image.height) / 2)
	}

	/// Masks of what's at `point` in the image at `uri`, from a part to the
	/// whole, as grayscale PNG files, or nil while that image isn't read.
	func masks(_ uri: URL, at point: PointRecord) throws -> ObjectMasksRecord? {
		guard let encoded, encoded.uri == uri else { return nil }
		let (width, height) = (encoded.width, encoded.height)
		let output = try decode(x: Float(point.x) * Float(width), y: Float(point.y) * Float(height))
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
		// The first is the single mask the decoder gives when told not to
		// guess, which the others cover.
		for index in 1..<count {
			let mask = Self.coverage(logits + index * size, count: size)
			if mask.area > 0 { masks.append((mask.values, mask.area, scores[index])) }
		}
		masks.sort { $0.area < $1.area }
		let distinct = masks.indices.filter { index in
			index == 0 || Double(masks[index].area) > Double(masks[index - 1].area) * (1 + Self.sameArea)
		}.map { masks[$0] }
		var likeliest = 0
		for (index, mask) in distinct.enumerated() where mask.score > distinct[likeliest].score {
			likeliest = index
		}
		return ObjectMasksRecord(
			masks: try distinct.map { try Self.writePng($0.values, width: width, height: height) },
			likeliest: likeliest
		)
	}

	/// A mask's logits as coverage from 0 to 255 (their sigmoid, so edges
	/// stay soft), and how many say the object is there.
	private static func coverage(_ logits: UnsafePointer<Float>, count: Int) -> (values: [UInt8], area: Int) {
		let length = vDSP_Length(count)
		var zero: Float = 0
		var one: Float = 1
		var minusOne: Float = -1
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
			vDSP_vsmul(logits, 1, &minusOne, floats, 1, length)
			vvexpf(floats, floats, &n)
			vDSP_vsadd(floats, 1, &one, floats, 1, length)
			vDSP_svdiv(&full, floats, 1, floats, 1, length)
			vDSP_vfixu8(floats, 1, &values, 1, length)
		}
		return (values, area)
	}

	/// Lets go of the models and the image, until they're needed again.
	func release() {
		encoded = nil
		sessions = nil
	}

	private func decode(x: Float, y: Float) throws -> [String: ORTValue] {
		guard let encoded else { throw ObjectSelectionException("No image is read") }
		func tensor(_ values: [Float], _ shape: [Int]) throws -> ORTValue {
			try ORTValue(
				tensorData: NSMutableData(bytes: values, length: values.count * MemoryLayout<Float>.size),
				elementType: .float,
				shape: shape.map { NSNumber(value: $0) }
			)
		}
		return try loadSessions().decoder.run(
			withInputs: [
				"image_embeddings": encoded.embeddings,
				// The point, and the padding point the decoder expects without a box.
				"point_coords": try tensor([x, y, 0, 0], [1, 2, 2]),
				"point_labels": try tensor([1, -1], [1, 2]),
				"mask_input": try tensor([Float](repeating: 0, count: 256 * 256), [1, 1, 256, 256]),
				"has_mask_input": try tensor([0], [1]),
				"orig_im_size": try tensor([Float(encoded.height), Float(encoded.width)], [2]),
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
	private static func encoderInput(_ uri: URL) throws -> (pixels: NSMutableData, width: Int, height: Int) {
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
		let pixels = NSMutableData(length: side * side * 3 * MemoryLayout<Float>.size)!
		let floats = pixels.mutableBytes.assumingMemoryBound(to: Float.self)
		for channel in 0..<3 {
			var value = mean[channel]
			vDSP_vfill(&value, floats + channel, 3, vDSP_Length(side * side))
			for row in 0..<height {
				vDSP_vfltu8(rgba + row * width * 4 + channel, 4, floats + row * side * 3 + channel, 3, vDSP_Length(width))
			}
		}
		return (pixels, width, height)
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
