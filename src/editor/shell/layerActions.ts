import type { Layer } from "../../model/layers/layer.ts";
import type { ToolStarters } from "./ToolsPanel.ts";

/**
 * The tools the dock offers for `layer`, by its kind, in the order it shows
 * them. A hidden photo can't be searched or cut out.
 */
export function layerActionsFor(layer: Layer): (keyof ToolStarters)[] {
	switch (layer.type) {
		case "image":
			return layer.hidden
				? ["redact", "adjust"]
				: ["redact", "adjust", "find", "cutOut"];
		case "drawing":
		case "shape":
			return ["draw"];
		case "redaction":
			return ["redact"];
		case "text":
			return [];
	}
}
