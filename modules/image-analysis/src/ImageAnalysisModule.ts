import { NativeModule, requireNativeModule } from "expo";
import type {
	Feature,
	ImagePoint,
	ObjectMasks,
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
	subjectMask(uri: string, at: ImagePoint | null): Promise<SubjectMask | null>;
	canSelectObjects(): boolean;
	prepareObjects(uri: string): Promise<void>;
	objectMasks(uri: string, at: ImagePoint): Promise<ObjectMasks | null>;
	releaseObjects(): Promise<void>;
}

export default requireNativeModule<ImageAnalysisModule>("ImageAnalysis");
