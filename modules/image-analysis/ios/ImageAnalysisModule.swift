import CoreImage
import ExpoModulesCore
import ImageIO
import Vision

public class ImageAnalysisModule: Module {
	// Selecting objects reads one image at a time, and a tap waits for it.
	private let objectQueue = DispatchQueue(label: "expo.modules.imageanalysis.objects", qos: .userInitiated)
	private var objectSelector: ObjectSelector?

	public func definition() -> ModuleDefinition {
		Name("ImageAnalysis")

		Function("canSelectObjects") { () -> Bool in
			true
		}

		AsyncFunction("prepareObjects") { (uri: URL) in
			if self.objectSelector == nil {
				self.objectSelector = try ObjectSelector()
			}
			try self.objectSelector?.prepare(uri)
		}.runOnQueue(objectQueue)

		AsyncFunction("objectMasks") { (uri: URL, at: PointRecord) -> ObjectMasksRecord? in
			try self.objectSelector?.masks(uri, at: at)
		}.runOnQueue(objectQueue)

		AsyncFunction("releaseObjects") {
			self.objectSelector?.release()
		}.runOnQueue(objectQueue)

		Function("isAvailable") { (feature: String) -> Bool in
			if feature == "background" {
				if #available(iOS 17.0, *) { return true }
				return false
			}
			return feature == "text" || feature == "faces"
		}

		AsyncFunction("imageSize") { (uri: URL) -> SizeRecord in
			let image = try SourceImage(url: uri)
			return SizeRecord(width: image.width, height: image.height)
		}

		// Vision decodes the image once for every tile's request.
		AsyncFunction("detectFaces") { (uri: URL, tiles: [RectRecord]) -> [[RectRecord]] in
			let image = try SourceImage(url: uri)
			let requests = tiles.map { tile in
				let request = VNDetectFaceRectanglesRequest()
				request.regionOfInterest = image.box(tile)
				pinToCPUOnSimulator(request)
				return request
			}
			try image.requestHandler().perform(requests)
			// Boxes are fractions of the whole image, not of the tile.
			return requests.map { request in
				(request.results ?? []).map { image.rect($0.boundingBox) }
			}
		}

		AsyncFunction("detectText") { (uri: URL) -> [TextRegionRecord] in
			let image = try SourceImage(url: uri)
			let request = VNRecognizeTextRequest()
			request.recognitionLevel = .accurate
			request.automaticallyDetectsLanguage = true
			try image.requestHandler().perform([request])

			return (request.results ?? []).compactMap { observation in
				guard let candidate = observation.topCandidates(1).first else { return nil }
				let words = wordRanges(candidate.string).compactMap { range in
					(try? candidate.boundingBox(for: range)).flatMap { $0 }.map {
						image.rect($0.boundingBox)
					}
				}
				return TextRegionRecord(line: image.rect(observation.boundingBox), words: words)
			}
		}

		// Every prominent subject together, at the image's full size. It needs
		// the Neural Engine or a real GPU, so it fails on the simulator.
		// With `at`, only the subject there.
		AsyncFunction("subjectMask") { (uri: URL, at: PointRecord?) -> SubjectMaskRecord? in
			guard #available(iOS 17.0, *) else {
				throw FeatureUnavailableException("background")
			}
			let image = try SourceImage(url: uri)
			let handler = image.requestHandler()
			let request = VNGenerateForegroundInstanceMaskRequest()
			try handler.perform([request])
			guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
				return nil
			}
			var instances = observation.allInstances
			var parts: PartMask?
			if let at {
				guard let picked = instance(in: observation.instanceMask, at: at) else { return nil }
				instances = IndexSet(integer: picked.label)
				parts = picked.otherParts
			}
			let buffer = try observation.generateScaledMaskForImage(
				forInstances: instances,
				from: handler
			)
			var mask = CIImage(cvPixelBuffer: buffer, options: [.colorSpace: NSNull()])
			if let parts {
				mask = mask.applyingFilter(
					"CIMultiplyCompositing",
					parameters: [kCIInputBackgroundImageKey: scaled(parts, to: mask.extent)]
				)
			}
			let file = FileManager.default.temporaryDirectory
				.appendingPathComponent("mask-\(UUID().uuidString).png")
			// The mask's values are coverage, not colors, so nothing converts them.
			let context = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])
			try context.writePNGRepresentation(
				of: mask,
				to: file,
				format: .L8,
				colorSpace: CGColorSpaceCreateDeviceGray()
			)
			return SubjectMaskRecord(
				uri: file.absoluteString,
				width: mask.extent.width,
				height: mask.extent.height
			)
		}
	}
}

/// An image file as Vision reads it, turned upright by its EXIF orientation.
struct SourceImage {
	let cgImage: CGImage
	let orientation: CGImagePropertyOrientation
	// Once upright: Vision's results are relative to this size.
	let width: Double
	let height: Double

	init(url: URL) throws {
		guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
			let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
		else {
			throw UnreadableImageException(url.absoluteString)
		}
		let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
		let exif = properties?[kCGImagePropertyOrientation] as? UInt32
		orientation = exif.flatMap(CGImagePropertyOrientation.init(rawValue:)) ?? .up
		self.cgImage = cgImage

		let sideways: Set<CGImagePropertyOrientation> = [.left, .leftMirrored, .right, .rightMirrored]
		let turned = sideways.contains(orientation)
		width = Double(turned ? cgImage.height : cgImage.width)
		height = Double(turned ? cgImage.width : cgImage.height)
	}

	func requestHandler() -> VNImageRequestHandler {
		VNImageRequestHandler(cgImage: cgImage, orientation: orientation)
	}

	/// Vision's boxes are fractions of the image, with the origin at the bottom left.
	func box(_ rect: RectRecord) -> CGRect {
		CGRect(
			x: rect.x / width,
			y: 1 - (rect.y + rect.height) / height,
			width: rect.width / width,
			height: rect.height / height
		)
	}

	func rect(_ box: CGRect) -> RectRecord {
		RectRecord(
			x: box.minX * width,
			y: (1 - box.maxY) * height,
			width: box.width * width,
			height: box.height * height
		)
	}
}

/// The simulator can't create the Neural Engine or GPU context face detection
/// asks for, and fails with "Could not create inference context".
private func pinToCPUOnSimulator(_ request: VNRequest) {
	#if targetEnvironment(simulator)
	if #available(iOS 17.0, *), let devices = try? request.supportedComputeStageDevices {
		for (stage, list) in devices {
			if let cpu = list.first(where: { if case .cpu = $0 { true } else { false } }) {
				request.setComputeDevice(cpu, for: stage)
			}
		}
	}
	#endif
}

/// How far from a tap a subject can be and still be picked, as a share of
/// the mask's longer side: a tap just off its edge still means it.
private let PICK_REACH = 0.02

/// The subject under `point` in an instance mask, whose pixels are each
/// subject's index and 0 for the background, or the nearest one within
/// `PICK_REACH`, with a mask of its parts other than the one there, when
/// it's more than one (see `otherParts`). The mask is the upright image's,
/// scaled down, with its first row at the top.
private func instance(
	in mask: CVPixelBuffer,
	at point: PointRecord
) -> (label: Int, otherParts: PartMask?)? {
	CVPixelBufferLockBaseAddress(mask, .readOnly)
	defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
	guard let base = CVPixelBufferGetBaseAddress(mask) else { return nil }
	let width = CVPixelBufferGetWidth(mask)
	let height = CVPixelBufferGetHeight(mask)
	let rowBytes = CVPixelBufferGetBytesPerRow(mask)
	let pixels = base.assumingMemoryBound(to: UInt8.self)
	let x = min(max(Int(point.x * Double(width)), 0), width - 1)
	let y = min(max(Int(point.y * Double(height)), 0), height - 1)
	let reach = max(1, Int(PICK_REACH * Double(max(width, height))))
	var nearest: (label: UInt8, column: Int, row: Int, distance: Int)?
	for row in max(0, y - reach)...min(height - 1, y + reach) {
		for column in max(0, x - reach)...min(width - 1, x + reach) {
			let label = pixels[row * rowBytes + column]
			if label == 0 { continue }
			let distance = (row - y) * (row - y) + (column - x) * (column - x)
			if distance <= reach * reach, distance < nearest?.distance ?? .max {
				nearest = (label, column, row, distance)
			}
		}
	}
	guard let nearest else { return nil }
	let parts = otherParts(
		of: nearest.label,
		in: pixels,
		width: width,
		height: height,
		rowBytes: rowBytes,
		column: nearest.column,
		row: nearest.row
	)
	return (Int(nearest.label), parts)
}

/// A parts mask stretched over `extent`, as the instance mask it came from
/// is over the image, smoothly so the cut between two parts isn't blocky.
private func scaled(_ parts: PartMask, to extent: CGRect) -> CIImage {
	let image = CIImage(
		bitmapData: Data(parts.bytes),
		bytesPerRow: parts.width,
		size: CGSize(width: parts.width, height: parts.height),
		format: .L8,
		colorSpace: nil
	)
	return image
		.clampedToExtent()
		.samplingLinear()
		.transformed(by: CGAffineTransform(
			scaleX: extent.width / CGFloat(parts.width),
			y: extent.height / CGFloat(parts.height)
		))
		.cropped(to: extent)
}

/// The ranges of `text` between whitespace, as ML Kit and Tesseract split words.
private func wordRanges(_ text: String) -> [Range<String.Index>] {
	var ranges: [Range<String.Index>] = []
	var start: String.Index?
	for index in text.indices {
		if text[index].isWhitespace {
			if let wordStart = start {
				ranges.append(wordStart..<index)
				start = nil
			}
		} else if start == nil {
			start = index
		}
	}
	if let wordStart = start {
		ranges.append(wordStart..<text.endIndex)
	}
	return ranges
}

struct RectRecord: Record {
	@Field var x: Double = 0
	@Field var y: Double = 0
	@Field var width: Double = 0
	@Field var height: Double = 0

	init() {}

	init(x: Double, y: Double, width: Double, height: Double) {
		self.x = x
		self.y = y
		self.width = width
		self.height = height
	}
}

struct PointRecord: Record {
	@Field var x: Double = 0
	@Field var y: Double = 0
}

struct SizeRecord: Record {
	@Field var width: Double = 0
	@Field var height: Double = 0

	init() {}

	init(width: Double, height: Double) {
		self.width = width
		self.height = height
	}
}

struct TextRegionRecord: Record {
	@Field var line = RectRecord()
	@Field var words: [RectRecord] = []

	init() {}

	init(line: RectRecord, words: [RectRecord]) {
		self.line = line
		self.words = words
	}
}

struct SubjectMaskRecord: Record {
	@Field var uri: String = ""
	@Field var width: Double = 0
	@Field var height: Double = 0

	init() {}

	init(uri: String, width: Double, height: Double) {
		self.uri = uri
		self.width = width
		self.height = height
	}
}

final class FeatureUnavailableException: GenericException<String>, @unchecked Sendable {
	override var reason: String {
		"Finding the \(param) isn't available on this device"
	}
}

final class UnreadableImageException: GenericException<String>, @unchecked Sendable {
	override var reason: String {
		"Couldn't read the image at \(param)"
	}
}
