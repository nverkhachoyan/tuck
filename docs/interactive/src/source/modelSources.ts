import adjustments from "@model/adjustments.ts?raw";
import cutout from "@model/cutout.ts?raw";
import documentFile from "@model/document.ts?raw";
import drawing from "@model/drawing.ts?raw";
import framing from "@model/framing.ts?raw";
import geometry from "@model/geometry.ts?raw";
import shapes from "@model/shapes.ts?raw";
import textEditing from "@model/textEditing.ts?raw";

// The model's files as text, so lessons quote the code as it is today.
export const modelSources = {
	"adjustments.ts": adjustments,
	"cutout.ts": cutout,
	"document.ts": documentFile,
	"drawing.ts": drawing,
	"framing.ts": framing,
	"geometry.ts": geometry,
	"shapes.ts": shapes,
	"textEditing.ts": textEditing,
};

export type ModelFile = keyof typeof modelSources;
