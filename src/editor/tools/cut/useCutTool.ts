import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { usePreference } from "@/platform/usePreference";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { visibleImageLayer } from "../../document/framing";
import type { ImageLayer } from "../../layers/image/image";
import { imagePointAt, isCutOut } from "../../layers/image/mask";
import { useRedactLook } from "../../shell/useRedactLook";
import { useStore } from "../../store";
import {
	type CutTapMode,
	cutCanvasTool,
	cutToolInUse,
	parseCutSettings,
	stepCutSize,
} from "./cutSettings";
import { useCutOut } from "./useCutOut";
import { useCutRedaction } from "./useCutRedaction";

export type CutController = ReturnType<typeof useCutTool>;

/**
 * Cut, on its `image` while it's open: its settings, kept between sessions,
 * the tool they and the device give, and selecting, inverting, clearing,
 * and redacting the selection, each undefined where it can't be done.
 * - The selection is the image's cut while Cut is open. An image that isn't
 *   cut opens selecting nothing, and Done with nothing selected cancels, so
 *   it's left as it was (`done`).
 * - A mask found after Cut was put down, or moved to another image, isn't
 *   wanted any more. Masks are kept through the host's `addImage`.
 * - A tap adds what's under it, or subtracts it, as `settings.tapMode`
 *   says; on web, holding Shift adds and holding Alt subtracts.
 * - `resize` steps the last tap's selection a size larger or smaller, while
 *   it's still the selection.
 * - Redacting the selection takes back the cut, adds a redaction in its
 *   shape, in the editor's redaction look, which is selected, and closes
 *   Cut (`close`).
 * - `stepSize` steps the brush's size for `[` and `]`, `canvasInput` paints
 *   or taps on a document of `documentSize`, while there's an image shown
 *   to cut, and `finishStroke` paints the selection, or selects what was
 *   tapped.
 */
export function useCutTool({
	image,
	documentSize,
	addImage,
	close,
}: Pick<ToolEnv, "image" | "documentSize" | "addImage" | "close">) {
	const layer = image ?? undefined;
	const key = useStore((state) => state.key);
	const { setMask, invertMask, cancelSession, addMaskedRedaction, paintMask } =
		useStore((state) => state.actions);
	const layerId = useRef<string | null>(null);
	layerId.current = layer?.id ?? null;
	// Saved under Cut out's key, so its settings carry over.
	const [settings, change] = usePreference("cutOut", parseCutSettings);
	const heldMode = useHeldTapMode();
	const { effectFor } = useRedactLook();
	const keep = (uri: string) => addImage(uri, false);
	const cutOut = useCutOut({
		key,
		image: layer,
		picking: settings.tool === "tap",
		latest: (id) => {
			const current = useStore.getState().document;
			return current ? visibleImageLayer(current, id) : undefined;
		},
		keep,
		onMask: (id, mask, keepStrokes) => {
			if (layerId.current === id) setMask(id, mask, { keepStrokes });
		},
		onInvert: (id, mask) => {
			if (layerId.current === id) invertMask(id, mask);
		},
	});
	const redaction = useCutRedaction({
		keep,
		onRedact: (id, mask, rect) => {
			if (layerId.current !== id) return;
			cancelSession();
			addMaskedRedaction(id, mask, rect, effectFor(documentSize));
			close();
		},
	});
	const cut = layer && isCutOut(layer) ? layer : undefined;
	// Nothing painted on the mask that selects nothing still selects nothing.
	const selected =
		cut &&
		(cut.mask !== cutOut.emptyMask ||
			cut.maskStrokes?.some((stroke) => stroke.type === "pen"))
			? cut
			: undefined;
	const { pickSize } = cutOut;
	const tool = cutToolInUse(settings, cutOut.canFind);
	const cutLayerId = layer?.id;
	const canvasInput = useMemo(
		(): CanvasInput | null =>
			cutLayerId === undefined
				? null
				: {
						type: "tool",
						tool: cutCanvasTool(cutLayerId, settings, tool, documentSize),
					},
		[cutLayerId, settings, tool, documentSize],
	);

	return {
		layer,
		settings,
		change,
		tool,
		canvasInput,
		// A sub-tool with no size, like Tap, leaves the settings alone.
		stepSize: (step: 1 | -1) => {
			const next = stepCutSize(settings, tool, step);
			if (next !== settings) change(next);
		},
		setTapMode: (tapMode: CutTapMode) => change({ ...settings, tapMode }),
		news: cutOut.news,
		finding: cutOut.finding,
		inverting: cutOut.inverting,
		redacting: redaction.busy,
		findAll:
			cutOut.canFind && layer ? () => void cutOut.findAll(layer) : undefined,
		resize:
			layer && pickSize && layer.mask === pickSize.mask
				? {
						index: pickSize.index,
						count: pickSize.count,
						step: (step: 1 | -1) => void cutOut.resize(layer, step),
					}
				: undefined,
		invert: cut ? () => void cutOut.invert(cut) : undefined,
		redact: selected ? () => void redaction.redact(selected) : undefined,
		reset: selected ? () => void cutOut.clear(selected, true) : undefined,
		// Opened on `image`, which this render doesn't show yet: one that
		// isn't cut yet starts selecting nothing; one that is starts
		// selecting what its cut keeps.
		start: (image: ImageLayer) => {
			if (isCutOut(image)) return;
			layerId.current = image.id;
			void cutOut.clear(image, false);
		},
		done: () => {
			if (!selected) cancelSession();
		},
		finishStroke: (stroke: ToolStroke) => {
			switch (stroke.type) {
				case "cutBrush": {
					// Undone back past the empty selection, an image paints one
					// first, since a pen adds only to a cut.
					const empty = cutOut.emptyMask;
					if (stroke.brush.type === "pen" && layer && !cut && empty) {
						setMask(layer.id, empty);
					}
					paintMask(stroke.layerId, { ...stroke.brush, points: stroke.points });
					break;
				}
				case "pickSubject": {
					const at = layer && imagePointAt(layer, stroke.point);
					const mode = heldMode.current ?? settings.tapMode;
					if (layer && at) void cutOut.pick(layer, at, mode === "add");
					break;
				}
			}
		},
	};
}

/**
 * Which way a tap goes while a key is held on web: Shift adds, and Alt
 * subtracts. Null otherwise, and once the window loses focus.
 */
function useHeldTapMode() {
	const held = useRef<CutTapMode | null>(null);
	useEffect(() => {
		// Native has a `window`, but no events on it.
		if (Platform.OS !== "web") return;
		const read = (event: KeyboardEvent) => {
			held.current = event.altKey ? "subtract" : event.shiftKey ? "add" : null;
		};
		const forget = () => {
			held.current = null;
		};
		window.addEventListener("keydown", read);
		window.addEventListener("keyup", read);
		window.addEventListener("blur", forget);
		return () => {
			window.removeEventListener("keydown", read);
			window.removeEventListener("keyup", read);
			window.removeEventListener("blur", forget);
		};
	}, []);
	return held;
}
