import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { createDoubleTap } from "./doubleTap.ts";
import { type TextSelection, wordRange } from "./selection.ts";

type PressPhase = "begin" | "move" | "end" | "cancel";

// A mouse or trackpad, which can hover, rather than a finger.
const hasFinePointer =
	Platform.OS === "web" &&
	typeof window !== "undefined" &&
	window.matchMedia("(pointer: fine)").matches;

/**
 * The options of `useCanvasTextGesture`.
 * - `text`: the text being edited.
 * - `toIndex(x, y, clamp)`: the index in `text` under a point in the view,
 *   or null off the text. With `clamp`, the nearest index instead, for a drag
 *   that leaves the text.
 * - `onSelect`: a press placed the caret, or selected.
 * - `onDone`: a tap off the text, to finish editing.
 * - `onCursor`: the cursor a mouse over the view should show.
 * - `tapSlop`: how far, in view points, a tap may travel and still count.
 */
export type CanvasTextGestureOptions = {
	text: string;
	toIndex: (x: number, y: number, clamp: boolean) => number | null;
	onSelect: (selection: TextSelection) => void;
	onDone: () => void;
	onCursor?: (cursor: "default" | "text") => void;
	tapSlop?: number;
};

/**
 * Presses on a canvas while text is edited in place: a press on the text
 * places the caret there, a drag from it selects, a double tap selects a
 * word, and a tap off the text finishes. A mouse over the text shows the
 * text cursor.
 *
 * The gesture reports the end when it finishes, however it does: iOS only
 * activates a pan once the finger moves, so a tap would otherwise never end.
 * A second finger cancels the press, leaving the two to zoom or pan the view.
 */
export function useCanvasTextGesture({
	text,
	toIndex,
	onSelect,
	onDone,
	onCursor,
	tapSlop = 6,
}: CanvasTextGestureOptions) {
	// The press under way: where it landed, and the index a drag selects
	// from, or null when it's off the text or selected a word.
	const press = useRef<{
		x: number;
		y: number;
		anchor: number | null;
		onText: boolean;
	} | null>(null);
	const [taps] = useState(createDoubleTap);
	// A press landing: on the text it places the caret, or on a double tap
	// selects the word, and either way is remembered for the drag that follows.
	const beginPress = useCallback(
		(x: number, y: number) => {
			const index = toIndex(x, y, false);
			const double = index !== null && taps.tap({ x, y });
			press.current = {
				x,
				y,
				anchor: double ? null : index,
				onText: index !== null,
			};
			if (index === null) return;
			onSelect(double ? wordRange(text, index) : { start: index, end: index });
		},
		[text, toIndex, taps, onSelect],
	);
	// A press moving or lifting: a drag from the text selects; a tap off the
	// text finishes, and a drag there does nothing.
	const followPress = useCallback(
		(phase: "move" | "end", x: number, y: number) => {
			const current = press.current;
			if (!current) return;
			if (phase === "end") press.current = null;
			if (current.anchor !== null) {
				const index = toIndex(x, y, true) ?? current.anchor;
				onSelect({
					start: Math.min(current.anchor, index),
					end: Math.max(current.anchor, index),
				});
				return;
			}
			const travel = Math.hypot(x - current.x, y - current.y);
			if (phase === "end" && !current.onText && travel < tapSlop) onDone();
		},
		[toIndex, onSelect, onDone, tapSlop],
	);
	const handlePress = useCallback(
		(phase: PressPhase, x: number, y: number) => {
			if (phase === "cancel") press.current = null;
			else if (phase === "begin") beginPress(x, y);
			else followPress(phase, x, y);
		},
		[beginPress, followPress],
	);
	const handleHover = useCallback(
		(x: number, y: number) =>
			onCursor?.(toIndex(x, y, false) === null ? "default" : "text"),
		[toIndex, onCursor],
	);
	// The handlers change with every keystroke, and a new gesture could cut
	// off a drag that's selecting, so the gesture keeps stable ones that call
	// the latest.
	const latest = useRef({ press: handlePress, hover: handleHover, onCursor });
	useLayoutEffect(() => {
		latest.current = { press: handlePress, hover: handleHover, onCursor };
	});
	const onPress = useCallback(
		(phase: PressPhase, x: number, y: number) =>
			latest.current.press(phase, x, y),
		[],
	);
	const onHover = useCallback(
		(x: number, y: number) => latest.current.hover(x, y),
		[],
	);
	const onHoverEnd = useCallback(
		() => latest.current.onCursor?.("default"),
		[],
	);
	const cancelled = useSharedValue(false);

	return useMemo(() => {
		const cancel = () => {
			"worklet";
			if (cancelled.value) return;
			cancelled.value = true;
			scheduleOnRN(onPress, "cancel", 0, 0);
		};

		// `minDistance(0)` begins at touch-down, and the second finger is
		// watched for here rather than with `maxPointers`, which would end the
		// pan without saying so.
		const pan = Gesture.Pan()
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

		return Gesture.Simultaneous(hover, pan);
	}, [onPress, onHover, onHoverEnd, cancelled]);
}
