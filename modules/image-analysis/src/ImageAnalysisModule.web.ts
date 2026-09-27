import { NativeModule, registerWebModule } from "expo";
import type { Feature, TextRegion } from "./ImageAnalysis.types";
import { tesseractText } from "./tesseractText";

class ImageAnalysisModule extends NativeModule {
	isAvailable(feature: Feature): boolean {
		return (
			feature === "text" &&
			typeof WebAssembly === "object" &&
			typeof Worker === "function"
		);
	}

	detectText(uri: string): Promise<TextRegion[]> {
		return tesseractText(uri);
	}
}

export default registerWebModule(ImageAnalysisModule, "ImageAnalysis");
