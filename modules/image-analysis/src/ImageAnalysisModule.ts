import { NativeModule, requireNativeModule } from "expo";
import type { Feature, TextRegion } from "./ImageAnalysis.types";

declare class ImageAnalysisModule extends NativeModule {
	isAvailable(feature: Feature): boolean;
	detectText(uri: string): Promise<TextRegion[]>;
}

export default requireNativeModule<ImageAnalysisModule>("ImageAnalysis");
