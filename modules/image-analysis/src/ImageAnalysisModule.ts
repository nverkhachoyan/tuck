import { NativeModule, requireNativeModule } from "expo";

declare class ImageAnalysisModule extends NativeModule {
	backend(): string;
}

export default requireNativeModule<ImageAnalysisModule>("ImageAnalysis");
