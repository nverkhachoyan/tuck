import ExpoModulesCore
import UIKit

public class ImageAnalysisModule: Module {
	public func definition() -> ModuleDefinition {
		Name("ImageAnalysis")

		Function("backend") {
			"Apple Vision on iOS \(UIDevice.current.systemVersion)"
		}
	}
}
