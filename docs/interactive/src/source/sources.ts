import adjustments from "@src/model/adjustments.ts?raw";
import cutout from "@src/model/cutout.ts?raw";
import documentFile from "@src/model/document.ts?raw";
import drawing from "@src/model/drawing.ts?raw";
import framing from "@src/model/framing.ts?raw";
import geometry from "@src/model/geometry.ts?raw";
import shapes from "@src/model/shapes.ts?raw";
import textEditing from "@src/model/textEditing.ts?raw";
import documentRenderScene from "@src/render/DocumentRenderScene.tsx?raw";
import decodedImages from "@src/render/decodedImages.ts?raw";
import decodeImageLayers from "@src/render/decodeImageLayers.ts?raw";
import fonts from "@src/render/fonts.ts?raw";
import imageLayerView from "@src/render/layers/ImageLayerView.tsx?raw";
import redactionLayerView from "@src/render/layers/RedactionLayerView.tsx?raw";
import textLayerView from "@src/render/layers/TextLayerView.tsx?raw";
import layerTransform from "@src/render/layerTransform.ts?raw";
import renderDocument from "@src/render/renderDocument.tsx?raw";
import hitTest from "@src/screens/editor/canvas/hitTest.ts?raw";
import layerBounds from "@src/screens/editor/canvas/layerBounds.ts?raw";
import cropGeometry from "@src/screens/editor/tools/crop/cropGeometry.ts?raw";
import exportFormat from "@src/screens/export/exportFormat.ts?raw";
import exportSizes from "@src/screens/export/exportSizes.ts?raw";
import editorSlice from "@src/store/editorSlice.ts?raw";
import storeIndex from "@src/store/index.ts?raw";

// The app's files as text, so lessons quote the code as it is today.
export const sources = {
	"src/model/adjustments.ts": adjustments,
	"src/model/cutout.ts": cutout,
	"src/model/document.ts": documentFile,
	"src/model/drawing.ts": drawing,
	"src/model/framing.ts": framing,
	"src/model/geometry.ts": geometry,
	"src/model/shapes.ts": shapes,
	"src/model/textEditing.ts": textEditing,
	"src/render/decodeImageLayers.ts": decodeImageLayers,
	"src/render/decodedImages.ts": decodedImages,
	"src/render/DocumentRenderScene.tsx": documentRenderScene,
	"src/render/fonts.ts": fonts,
	"src/render/layers/ImageLayerView.tsx": imageLayerView,
	"src/render/layerTransform.ts": layerTransform,
	"src/render/layers/RedactionLayerView.tsx": redactionLayerView,
	"src/render/renderDocument.tsx": renderDocument,
	"src/render/layers/TextLayerView.tsx": textLayerView,
	"src/screens/editor/canvas/hitTest.ts": hitTest,
	"src/screens/editor/canvas/layerBounds.ts": layerBounds,
	"src/screens/editor/tools/crop/cropGeometry.ts": cropGeometry,
	"src/screens/export/exportFormat.ts": exportFormat,
	"src/screens/export/exportSizes.ts": exportSizes,
	"src/store/editorSlice.ts": editorSlice,
	"src/store/index.ts": storeIndex,
};

export type SourceFile = keyof typeof sources;
