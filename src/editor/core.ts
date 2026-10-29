/**
 * The editor's plain-TypeScript entry: what code outside the editor needs of
 * the document without loading React, React Native, or Skia, so Node's tests
 * can import it.
 * - `projects/` checks and saves documents, and its tests build every layer type.
 * - The screens make an empty document and read whether one has edits or transparency.
 * - `photos/` and the screens size images with `Size`.
 */
export type { EditorDocument } from "./document/document.ts";
export {
	createBlankDocument,
	createDocumentFromImage,
	hasEdits,
	hasTransparency,
} from "./document/document.ts";
export type { Size } from "./document/geometry.ts";
export { isColorOrNull, isFields, isPositive } from "./document/values.ts";
export { createDrawingLayer } from "./layers/drawing/drawing.ts";
export type { ImageLayer } from "./layers/image/image.ts";
export {
	createImageLayer,
	createStickerLayer,
	withAdjustments,
} from "./layers/image/image.ts";
export { withMask } from "./layers/image/mask.ts";
export { isLayer, layerFiles } from "./layers/layer.ts";
export {
	createMaskedRedaction,
	createRedactionBox,
	createRedactionStrokes,
} from "./layers/redaction/redaction.ts";
export { createShapeLayer } from "./layers/shape/shape.ts";
export type { MaskStroke } from "./layers/strokes.ts";
export { createTextLayer } from "./layers/text/text.ts";
