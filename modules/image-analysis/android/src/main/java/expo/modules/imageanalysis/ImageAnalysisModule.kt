package expo.modules.imageanalysis

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ImageAnalysisModule : Module() {
	override fun definition() = ModuleDefinition {
		Name("ImageAnalysis")

		Function("backend") {
			"ML Kit on Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
		}
	}
}
