import adjustments from "@src/model/adjustments.ts?raw";
import cutout from "@src/model/cutout.ts?raw";
import documentFile from "@src/model/document.ts?raw";
import drawing from "@src/model/drawing.ts?raw";
import framing from "@src/model/framing.ts?raw";
import geometry from "@src/model/geometry.ts?raw";
import shapes from "@src/model/shapes.ts?raw";
import textEditing from "@src/model/textEditing.ts?raw";
import layerBounds from "@src/screens/editor/canvas/layerBounds.ts?raw";

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
	"src/screens/editor/canvas/layerBounds.ts": layerBounds,
};

export type SourceFile = keyof typeof sources;
