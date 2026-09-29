import { NativeModule, requireNativeModule } from "expo";
import type {
	Feature,
	Rect,
	Size,
	SubjectMask,
	TextRegion,
} from "./ImageAnalysis.types";

declare class ImageAnalysisModule extends NativeModule {
	isAvailable(feature: Feature): boolean;
	imageSize(uri: string): Promise<Size>;
	/** The faces in each of `tiles`, in the whole image's pixels. */
	detectFaces(uri: string, tiles: Rect[]): Promise<Rect[][]>;
	detectText(uri: string): Promise<TextRegion[]>;
	subjectMask(uri: string): Promise<SubjectMask | null>;
}

export default requireNativeModule<ImageAnalysisModule>("ImageAnalysis");
