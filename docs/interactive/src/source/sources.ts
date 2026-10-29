import hitTest from "@src/editor/canvas/hitTest.ts?raw";
import layerBounds from "@src/editor/canvas/layerBounds.ts?raw";
import imageLayerView from "@src/editor/layers/image/ImageLayerView.tsx?raw";
import layerTransform from "@src/editor/layers/layerTransform.ts?raw";
import redactionLayerView from "@src/editor/layers/redaction/RedactionLayerView.tsx?raw";
import fonts from "@src/editor/layers/text/fonts.ts?raw";
import textLayerView from "@src/editor/layers/text/TextLayerView.tsx?raw";
import documentRenderScene from "@src/editor/render/DocumentRenderScene.tsx?raw";
import decodedImages from "@src/editor/render/decodedImages.ts?raw";
import decodeImageLayers from "@src/editor/render/decodeImageLayers.ts?raw";
import renderDocument from "@src/editor/render/renderDocument.tsx?raw";
import editorSlice from "@src/editor/store/editorSlice.ts?raw";
import storeIndex from "@src/editor/store/index.ts?raw";
import cropGeometry from "@src/editor/tools/crop/cropGeometry.ts?raw";
import adjustments from "@src/model/adjustments.ts?raw";
import cutout from "@src/model/cutout.ts?raw";
import documentFile from "@src/model/document.ts?raw";
import adjust from "@src/model/edits/adjust.ts?raw";
import crop from "@src/model/edits/crop.ts?raw";
import draw from "@src/model/edits/draw.ts?raw";
import layers from "@src/model/edits/layers.ts?raw";
import framing from "@src/model/framing.ts?raw";
import geometry from "@src/model/geometry.ts?raw";
import layerDrawing from "@src/model/layers/drawing.ts?raw";
import layerImage from "@src/model/layers/image.ts?raw";
import layerFile from "@src/model/layers/layer.ts?raw";
import layerRedaction from "@src/model/layers/redaction.ts?raw";
import layerShape from "@src/model/layers/shape.ts?raw";
import layerText from "@src/model/layers/text.ts?raw";
import shapes from "@src/model/shapes.ts?raw";
import strokes from "@src/model/strokes.ts?raw";
import exportFormat from "@src/screens/export/exportFormat.ts?raw";
import exportSizes from "@src/screens/export/exportSizes.ts?raw";

// The app's files as text, so lessons quote the code as it is today.
export const sources = {
	"src/model/adjustments.ts": adjustments,
	"src/model/cutout.ts": cutout,
	"src/model/document.ts": documentFile,
	"src/model/edits/adjust.ts": adjust,
	"src/model/edits/crop.ts": crop,
	"src/model/edits/draw.ts": draw,
	"src/model/edits/layers.ts": layers,
	"src/model/framing.ts": framing,
	"src/model/geometry.ts": geometry,
	"src/model/layers/drawing.ts": layerDrawing,
	"src/model/layers/image.ts": layerImage,
	"src/model/layers/layer.ts": layerFile,
	"src/model/layers/redaction.ts": layerRedaction,
	"src/model/layers/shape.ts": layerShape,
	"src/model/layers/text.ts": layerText,
	"src/model/shapes.ts": shapes,
	"src/model/strokes.ts": strokes,
	"src/editor/render/decodeImageLayers.ts": decodeImageLayers,
	"src/editor/render/decodedImages.ts": decodedImages,
	"src/editor/render/DocumentRenderScene.tsx": documentRenderScene,
	"src/editor/layers/text/fonts.ts": fonts,
	"src/editor/layers/image/ImageLayerView.tsx": imageLayerView,
	"src/editor/layers/layerTransform.ts": layerTransform,
	"src/editor/layers/redaction/RedactionLayerView.tsx": redactionLayerView,
	"src/editor/render/renderDocument.tsx": renderDocument,
	"src/editor/layers/text/TextLayerView.tsx": textLayerView,
	"src/editor/canvas/hitTest.ts": hitTest,
	"src/editor/canvas/layerBounds.ts": layerBounds,
	"src/editor/tools/crop/cropGeometry.ts": cropGeometry,
	"src/screens/export/exportFormat.ts": exportFormat,
	"src/screens/export/exportSizes.ts": exportSizes,
	"src/editor/store/editorSlice.ts": editorSlice,
	"src/editor/store/index.ts": storeIndex,
};

export type SourceFile = keyof typeof sources;
