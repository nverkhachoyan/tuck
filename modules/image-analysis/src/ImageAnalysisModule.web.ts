import { NativeModule, registerWebModule } from "expo";

class ImageAnalysisModule extends NativeModule {
	backend(): string {
		return "MediaPipe and Tesseract on the web";
	}
}

export default registerWebModule(ImageAnalysisModule, "ImageAnalysis");
