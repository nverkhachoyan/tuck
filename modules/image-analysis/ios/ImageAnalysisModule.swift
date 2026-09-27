import ExpoModulesCore
import ImageIO
import Vision

public class ImageAnalysisModule: Module {
	public func definition() -> ModuleDefinition {
		Name("ImageAnalysis")

		Function("isAvailable") { (feature: String) -> Bool in
			feature == "text"
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
	}
}

/// An image file as Vision reads it, turned upright by its EXIF orientation.
private struct SourceImage {
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
	func rect(_ box: CGRect) -> RectRecord {
		RectRecord(
			x: box.minX * width,
			y: (1 - box.maxY) * height,
			width: box.width * width,
			height: box.height * height
		)
	}
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

struct TextRegionRecord: Record {
	@Field var line = RectRecord()
	@Field var words: [RectRecord] = []

	init() {}

	init(line: RectRecord, words: [RectRecord]) {
		self.line = line
		self.words = words
	}
}

final class UnreadableImageException: GenericException<String>, @unchecked Sendable {
	override var reason: String {
		"Couldn't read the image at \(param)"
	}
}
