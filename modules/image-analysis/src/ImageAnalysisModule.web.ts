import { NativeModule, registerWebModule } from "expo";
import type { Feature, Rect, Size, TextRegion } from "./ImageAnalysis.types";
import { imageSize, mediaPipeFaces } from "./mediaPipeFaces";
import { tesseractText } from "./tesseractText";

class ImageAnalysisModule extends NativeModule {
	isAvailable(feature: Feature): boolean {
		if (typeof WebAssembly !== "object") return false;
		switch (feature) {
			case "faces":
				return (
					typeof createImageBitmap === "function" &&
					typeof OffscreenCanvas === "function"
				);
			case "text":
				return typeof Worker === "function";
		}
	}

	imageSize(uri: string): Promise<Size> {
		return imageSize(uri);
	}

	detectFaces(uri: string, tiles: Rect[]): Promise<Rect[][]> {
		return mediaPipeFaces(uri, tiles);
	}

	detectText(uri: string): Promise<TextRegion[]> {
		return tesseractText(uri);
	}
}

export default registerWebModule(ImageAnalysisModule, "ImageAnalysis");
