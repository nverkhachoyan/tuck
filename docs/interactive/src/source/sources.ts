import hitTest from "@src/editor/canvas/hitTest.ts?raw";
import layerBounds from "@src/editor/canvas/layerBounds.ts?raw";
import documentFile from "@src/editor/document/document.ts?raw";
import crop from "@src/editor/document/documentEdits.ts?raw";
import framing from "@src/editor/document/framing.ts?raw";
import geometry from "@src/editor/document/geometry.ts?raw";
import layerDrawing from "@src/editor/layers/drawing/drawing.ts?raw";
import draw from "@src/editor/layers/drawing/drawingEdits.ts?raw";
import adjustments from "@src/editor/layers/image/adjustments.ts?raw";
import imageLayerView from "@src/editor/layers/image/ImageLayerView.tsx?raw";
import layerImage from "@src/editor/layers/image/image.ts?raw";
import adjust from "@src/editor/layers/image/imageEdits.ts?raw";
import cutout from "@src/editor/layers/image/mask.ts?raw";
import layerFile from "@src/editor/layers/layer.ts?raw";
import layers from "@src/editor/layers/layerEdits.ts?raw";
import layerTransform from "@src/editor/layers/layerTransform.ts?raw";
import redactionLayerView from "@src/editor/layers/redaction/RedactionLayerView.tsx?raw";
import layerRedaction from "@src/editor/layers/redaction/redaction.ts?raw";
import layerShape from "@src/editor/layers/shape/shape.ts?raw";
import shapes from "@src/editor/layers/shape/shapeGeometry.ts?raw";
import strokes from "@src/editor/layers/strokes.ts?raw";
import fonts from "@src/editor/layers/text/fonts.ts?raw";
import textLayerView from "@src/editor/layers/text/TextLayerView.tsx?raw";
import layerText from "@src/editor/layers/text/text.ts?raw";
import documentRenderScene from "@src/editor/render/DocumentRenderScene.tsx?raw";
import decodedImages from "@src/editor/render/decodedImages.ts?raw";
import decodeImageLayers from "@src/editor/render/decodeImageLayers.ts?raw";
import renderDocument from "@src/editor/render/renderDocument.tsx?raw";
import editorSlice from "@src/editor/store/editorSlice.ts?raw";
import storeIndex from "@src/editor/store/index.ts?raw";
import cropGeometry from "@src/editor/tools/crop/cropGeometry.ts?raw";
import exportFormat from "@src/screens/export/exportFormat.ts?raw";
import exportSizes from "@src/screens/export/exportSizes.ts?raw";

// The app's files as text, so lessons quote the code as it is today.
export const sources = {
	"src/editor/layers/image/adjustments.ts": adjustments,
	"src/editor/layers/image/mask.ts": cutout,
	"src/editor/document/document.ts": documentFile,
	"src/editor/layers/image/imageEdits.ts": adjust,
	"src/editor/document/documentEdits.ts": crop,
	"src/editor/layers/drawing/drawingEdits.ts": draw,
	"src/editor/layers/layerEdits.ts": layers,
	"src/editor/document/framing.ts": framing,
	"src/editor/document/geometry.ts": geometry,
	"src/editor/layers/drawing/drawing.ts": layerDrawing,
	"src/editor/layers/image/image.ts": layerImage,
	"src/editor/layers/layer.ts": layerFile,
	"src/editor/layers/redaction/redaction.ts": layerRedaction,
	"src/editor/layers/shape/shape.ts": layerShape,
	"src/editor/layers/text/text.ts": layerText,
	"src/editor/layers/shape/shapeGeometry.ts": shapes,
	"src/editor/layers/strokes.ts": strokes,
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
