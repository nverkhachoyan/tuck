// Relative `.ts` imports keep this loadable by Node's test runner.
import type { DialDrag } from "../Dial.tsx";
import type { CanvasTool } from "./EditorScene.tsx";

/**
 * What input on the canvas does, one at a time: select and transform
 * layers; paint, drag out a box or a shape, or pick a color with a `tool`;
 * place the caret in, or select, the text being edited; toggle what Find
 * found in the image `imageId`; or, while adjusting, hold the layers still
 * and turn the dial with a sideways drag (`drag`).
 */
export type CanvasInput =
	| { type: "select" }
	| { type: "tool"; tool: CanvasTool }
	| { type: "editText" }
	| { type: "find"; imageId: string; onToggle: (sourceIndex: number) => void }
	| { type: "adjust"; drag: DialDrag };

export type InputRules = {
	// The selection neither moves nor shows its handles, and two fingers
	// zoom the view wherever they land.
	holdsStill: boolean;
	// Where one finger pans the view: anywhere, where taps don't drag; off
	// the selection and its handles, while zoomed in; or nowhere.
	oneFinger: "anywhere" | "offSelection" | null;
	// The pointer's cursor, or "hover" to leave it to what's under it.
	cursor: "pointer" | "crosshair" | "grab" | "ew-resize" | "default" | "hover";
};

/** What `input` asks of the canvas's shared behavior, `zoomed` in or not. */
export function inputRules(input: CanvasInput, zoomed: boolean): InputRules {
	switch (input.type) {
		case "select":
			return {
				holdsStill: false,
				oneFinger: zoomed ? "offSelection" : null,
				cursor: "hover",
			};
		case "tool":
			return { holdsStill: true, oneFinger: null, cursor: "crosshair" };
		case "editText":
			return { holdsStill: true, oneFinger: null, cursor: "hover" };
		case "find":
			return { holdsStill: true, oneFinger: "anywhere", cursor: "pointer" };
		// One finger turns the dial, so two move the view.
		case "adjust":
			return { holdsStill: true, oneFinger: null, cursor: "ew-resize" };
	}
}
