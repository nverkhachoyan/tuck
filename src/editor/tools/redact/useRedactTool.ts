import { useMemo } from "react";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import {
	redactionEffect,
	sameEffect,
	withEffect,
} from "../../shell/redactLook";
import { useRedactLook } from "../../shell/useRedactLook";
import { useStore } from "../../store";
import { selectSelectedRedaction } from "../../store/editorSlice";
import {
	parseRedactSettings,
	type RedactChoices,
	redactCanvasTool,
	stepRedactSize,
} from "./redactSettings";

export type RedactController = ReturnType<typeof useRedactTool>;

/**
 * Redact's settings, kept between sessions, with the editor's redaction
 * look, which Find and Cut redact with too. They show the selected
 * redaction's style, which new ones then share, so a redaction can be
 * picked to match. Changing them restyles that one. `stepSize` steps the
 * brush's size for `[` and `]`, `canvasInput` brushes or drags out
 * redactions with them, and `finishStroke` adds what's brushed or dragged
 * out to the document.
 */
export function useRedactTool({ documentSize }: Pick<ToolEnv, "documentSize">) {
	const [chosen, setChosen] = usePreference(
		"redactSettings",
		parseRedactSettings,
	);
	const { look, changeLook } = useRedactLook();
	const selectedRedaction = useStore(selectSelectedRedaction);
	const { setRedactionEffect, paintRedaction, addRedactionBox } = useStore(
		(state) => state.actions,
	);
	const settings = useMemo(() => {
		const choices: RedactChoices = { ...look, ...chosen };
		return selectedRedaction
			? withEffect(choices, selectedRedaction.effect, documentSize)
			: choices;
	}, [look, chosen, selectedRedaction, documentSize]);
	const change = (next: RedactChoices) => {
		const { effect, color, strength, tool, brushSize, eraserSize } = next;
		changeLook({ effect, color, strength });
		setChosen({ tool, brushSize, eraserSize });
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

	const finishStroke = (stroke: ToolStroke) => {
		switch (stroke.type) {
			case "redactBrush":
				paintRedaction(
					{ ...stroke.brush, points: stroke.points },
					stroke.effect,
				);
				break;
			case "redactBox":
				addRedactionBox(stroke.rect, stroke.effect);
				break;
		}
	};

	return { settings, change, chooseTool, stepSize, canvasInput, finishStroke };
}
