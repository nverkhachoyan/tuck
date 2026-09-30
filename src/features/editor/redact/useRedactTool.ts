import { useMemo } from "react";
import { usePreference } from "@/lib/usePreference";
import type { Size } from "@/model/geometry";
import { useStore } from "@/store";
import { selectSelectedRedaction } from "@/store/editorSlice";
import {
	parseRedactSettings,
	type RedactSettings,
	redactionEffect,
	sameEffect,
	withEffect,
} from "./redactSettings";

/**
 * Redact's settings, kept between sessions as `chosen`, which Find uses
 * too. They show the selected redaction's style, which new ones then share,
 * so a redaction can be picked to match. Changing them restyles that one.
 */
export function useRedactTool(documentSize: Size) {
	const selectedRedaction = useStore(selectSelectedRedaction);
	const setRedactionEffect = useStore((state) => state.setRedactionEffect);
	const [chosen, setChosen] = usePreference(
		"redactSettings",
		parseRedactSettings,
	);
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
				? selectedRedaction.shape === "box"
					? "box"
					: "brush"
				: current.tool === "eraser"
					? "brush"
					: current.tool,
		}));

	return { settings, change, chooseTool, chosen, setChosen };
}
