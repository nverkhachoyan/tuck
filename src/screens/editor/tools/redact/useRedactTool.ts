import { type Dispatch, type SetStateAction, useMemo } from "react";
import type { Size } from "@/model/geometry";
import { useStore } from "@/store";
import { selectSelectedRedaction } from "@/store/editorSlice";
import type { CanvasInput } from "../../canvasInputFor";
import {
	redactionEffect,
	sameEffect,
	withEffect,
} from "../../shell/redactLook";
import {
	type RedactSettings,
	redactCanvasTool,
	stepRedactSize,
} from "./redactSettings";

export type RedactController = ReturnType<typeof useRedactTool>;

/**
 * Redact's settings, from the saved ones (`chosen`), whose look Find and Cut
 * out redact with too. They show the selected redaction's style, which new
 * ones then share, so a redaction can be picked to match. Changing them
 * restyles that one. `stepSize` steps the brush's size for `[` and `]`, and
 * `canvasInput` brushes or drags out redactions with them.
 */
export function useRedactTool(
	documentSize: Size,
	chosen: RedactSettings,
	setChosen: Dispatch<SetStateAction<RedactSettings>>,
) {
	const selectedRedaction = useStore(selectSelectedRedaction);
	const { setRedactionEffect } = useStore((state) => state.actions);
	const settings = useMemo(
		() =>
			selectedRedaction
				? withEffect(chosen, selectedRedaction.effect, documentSize)
				: chosen,
		[chosen, selectedRedaction, documentSize],
	);
	const change = (next: RedactSettings) => {
		setChosen(next);
		if (selectedRedaction && !sameEffect(settings, next)) {
			setRedactionEffect(
				selectedRedaction.id,
				redactionEffect(next, documentSize),
			);
		}
	};
	// For redacting to start with the tool that adds to the selected
	// redaction, if there is one. Otherwise the last one used, but never the
	// eraser, so the first drag shows.
	const chooseTool = () =>
		setChosen((current) => ({
			...current,
			tool: selectedRedaction
				? selectedRedaction.shape === "strokes"
					? "brush"
					: "box"
				: current.tool === "eraser"
					? "brush"
					: current.tool,
		}));

	const stepSize = (step: 1 | -1) => {
		const next = stepRedactSize(settings, step);
		if (next !== settings) change(next);
	};

	const canvasInput = useMemo(
		(): CanvasInput => ({
			type: "tool",
			tool: redactCanvasTool(settings, documentSize),
		}),
		[settings, documentSize],
	);

	return { settings, change, chooseTool, stepSize, canvasInput };
}
