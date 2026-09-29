import { NativeModule, registerWebModule } from "expo";
import type {
	Feature,
	Rect,
	Size,
	SubjectMask,
	TextRegion,
} from "./ImageAnalysis.types";
import { imageSize, mediaPipeFaces } from "./mediaPipeFaces";
import { mediaPipeSubject } from "./mediaPipeSubject";
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
			case "background":
				return typeof OffscreenCanvas === "function";
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

	subjectMask(uri: string): Promise<SubjectMask | null> {
		return mediaPipeSubject(uri);
	}
}

export default registerWebModule(ImageAnalysisModule, "ImageAnalysis");
