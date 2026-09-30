import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { layerBounds } from "@/layers/layerBounds";
import { type TextSelection, wordRange } from "@/layers/textEditing";
import { textIndexAt } from "@/layers/textLayerLayout";
import { hitTestBox, toLayerSpace } from "@/model/geometry";
import type { TextEditState } from "../editorMode";
import { hasFinePointer } from "../handles/handleMetrics";
import { type DocumentViewport, viewPointToDocument } from "../viewport";
import { createDoubleTap } from "./doubleTap";
import { HIT_PADDING_PX } from "./layerTargets";
import { TAP_SLOP_PX } from "./strokeIntent";

type TextPressPhase = "begin" | "move" | "end" | "cancel";

/**
 * Presses on the canvas while text is edited in place: a press on the text
 * places the caret there, a drag from it selects, a double tap selects a
 * word, and a tap off the text finishes (`onDone`). A mouse over the text
 * shows the text cursor.
 *
 * The gesture reports the end when it finishes, however it does: iOS only
 * activates a pan once the finger moves, so a tap would otherwise never end.
 * A second finger cancels the press, leaving the two to zoom the view; it's
 * watched for as the paint gesture does (see `usePaintGesture`).
 */
export function useTextEditGesture({
	edit,
	viewport,
	onSelect,
	onDone,
	onCursor,
}: {
	edit: TextEditState | null;
	viewport: DocumentViewport;
	onSelect?: (selection: TextSelection) => void;
	onDone?: () => void;
	onCursor: (cursor: "default" | "text") => void;
}) {
	const { scale } = viewport;
	// Where the edited text is under a point reported by the view: the index
	// of its text there, or null off it, or outside its box.
	const textIndexUnder = useCallback(
		(screenX: number, screenY: number, clampToText = false) => {
			if (!edit || scale === 0) return null;
			const { layer } = edit;
			const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
			const padding = HIT_PADDING_PX / (scale * layer.transform.scaleX);
			if (
				!clampToText &&
				!hitTestBox(layer.transform, layerBounds(layer, padding), point)
			) {
				return null;
			}
			return textIndexAt(layer, toLayerSpace(layer.transform, point));
		},
		[edit, scale, viewport],
	);
	// The press under way on edited text: where it landed, and the index a
	// drag selects from, or null when it's off the text or selected a word.
	const textPress = useRef<{
		x: number;
		y: number;
		anchor: number | null;
		onText: boolean;
	} | null>(null);
	const [taps] = useState(createDoubleTap);
	const handlePress = useCallback(
		(phase: TextPressPhase, screenX: number, screenY: number) => {
			if (!edit) return;
			// A second finger landed, to zoom.
			if (phase === "cancel") {
				textPress.current = null;
				return;
			}
			if (phase === "begin") {
				const index = textIndexUnder(screenX, screenY);
				const double = index !== null && taps.tap({ x: screenX, y: screenY });
				textPress.current = {
					x: screenX,
					y: screenY,
					anchor: double ? null : index,
					onText: index !== null,
				};
				if (index === null) return;
				onSelect?.(
					double
						? wordRange(edit.layer.text, index)
						: { start: index, end: index },
				);
				return;
			}
			const press = textPress.current;
			if (!press) return;
			if (phase === "end") textPress.current = null;
			if (press.anchor !== null) {
				const index = textIndexUnder(screenX, screenY, true) ?? press.anchor;
				onSelect?.({
					start: Math.min(press.anchor, index),
					end: Math.max(press.anchor, index),
				});
				return;
			}
			// A tap off the text finishes; a drag there does nothing.
			const travel = Math.hypot(screenX - press.x, screenY - press.y);
			if (phase === "end" && !press.onText && travel < TAP_SLOP_PX) {
				onDone?.();
			}
		},
		[edit, textIndexUnder, taps, onSelect, onDone],
	);
	const handleHover = useCallback(
		(screenX: number, screenY: number) =>
			onCursor(textIndexUnder(screenX, screenY) === null ? "default" : "text"),
		[textIndexUnder, onCursor],
	);
	// The handlers change with every keystroke, and a new gesture could cut
	// off a drag that's selecting, so the gesture keeps stable ones that call
	// the latest.
	const latest = useRef({ press: handlePress, hover: handleHover, onCursor });
	useLayoutEffect(() => {
		latest.current = { press: handlePress, hover: handleHover, onCursor };
	});
	const onPress = useCallback(
		(phase: TextPressPhase, x: number, y: number) =>
			latest.current.press(phase, x, y),
		[],
	);
	const onHover = useCallback(
		(x: number, y: number) => latest.current.hover(x, y),
		[],
	);
	const onHoverEnd = useCallback(() => latest.current.onCursor("default"), []);
	const cancelled = useSharedValue(false);

	return useMemo(() => {
		const cancel = () => {
			"worklet";
			if (cancelled.value) return;
			cancelled.value = true;
			scheduleOnRN(onPress, "cancel", 0, 0);
		};

		const press = Gesture.Pan()
			.minDistance(0)
			.onTouchesDown((event) => {
				if (event.numberOfTouches === 1) cancelled.value = false;
				else cancel();
			})
			.onBegin((event) => {
				if (cancelled.value) return;
				scheduleOnRN(onPress, "begin", event.x, event.y);
				if (event.numberOfPointers > 1) cancel();
			})
			.onUpdate((event) => {
				if (event.numberOfPointers > 1) cancel();
				if (cancelled.value) return;
				scheduleOnRN(onPress, "move", event.x, event.y);
			})
			.onFinalize((event) => {
				if (cancelled.value) return;
				scheduleOnRN(onPress, "end", event.x, event.y);
			});

		const hover = Gesture.Hover()
			.enabled(hasFinePointer)
			.onBegin((event) => {
				scheduleOnRN(onHover, event.x, event.y);
			})
			.onUpdate((event) => {
				scheduleOnRN(onHover, event.x, event.y);
			})
			.onEnd(() => {
				scheduleOnRN(onHoverEnd);
			});

		return Gesture.Simultaneous(hover, press);
	}, [onPress, onHover, onHoverEnd, cancelled]);
}
