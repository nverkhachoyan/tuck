import { useMemo } from "react";
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";
import { straightStroke } from "../layers/strokes";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

// A point closer than this to the last one, in screen pixels, adds nothing
// anyone could see.
const MIN_POINT_GAP_PX = 1.5;
// Holding the highlighter within this many screen pixels straightens it.
const STILL_PX = 8;
const STILL_MS = 500;

/**
 * Painting with one finger. The line it draws gathers in `points`, in
 * document space, for the canvas to draw as it grows, and is handed to
 * `onStroke` once the finger lifts, with the stroke's `strokeId`. Each
 * stroke's id is one more than the last's. A second finger cancels it.
 *
 * It commits when the gesture finishes, however it does: iOS only activates
 * a pan once the finger moves, so a tap that doesn't would otherwise leave
 * no dot. For the same reason a second finger is watched for here rather
 * than failing the pan with `maxPointers`, which a tap would also look like.
 *
 * A stroke that starts where `standsAside` says, which is decided where the
 * finger lands, is left alone to lift, and handed to no one.
 *
 * When `straighten` is set, a highlighter holds still for half a second and
 * the stroke becomes the line from where it began. Shift held at its first
 * move (`shiftHeld`) does that from the start. It then follows as that line.
 */
export function usePaintGesture({
	viewport,
	points,
	strokeId,
	onStroke,
	standsAside = null,
	straighten = false,
	shiftHeld = null,
}: {
	viewport: DocumentViewport;
	points: SharedValue<number[]>;
	strokeId: SharedValue<number>;
	onStroke: (points: number[], id: number) => void;
	// Whether one finger landing at a point is another gesture's. A worklet.
	standsAside?: ((screenX: number, screenY: number) => boolean) | null;
	// The highlighter: hold still, or hold Shift on web, and it draws a line.
	straighten?: boolean;
	shiftHeld?: SharedValue<boolean> | null;
}) {
	const cancelled = useSharedValue(false);
	const aside = useSharedValue(false);
	const straight = useSharedValue(false);
	const moved = useSharedValue(false);
	const generation = useSharedValue(0);
	const anchorX = useSharedValue(0);
	const anchorY = useSharedValue(0);
	const tick = Platform.OS !== "web";

	return useMemo(() => {
		// Rounded as the model rounds strokes, so a saved stroke is what was drawn.
		const toDocument = (x: number, y: number) => {
			"worklet";
			const point = viewPointToDocument(viewport, { x, y });
			return [Math.round(point.x * 100) / 100, Math.round(point.y * 100) / 100];
		};

		const cancel = () => {
			"worklet";
			cancelled.value = true;
			generation.value += 1;
			points.value = [];
		};

		const markStraight = () => {
			"worklet";
			if (straight.value || cancelled.value || aside.value) return;
			generation.value += 1;
			straight.value = true;
			points.value = straightStroke(points.value);
			if (tick) scheduleOnRN(hapticTick);
		};

		// The UI thread's timer. A move past `STILL_PX` starts another, and
		// lifting or straightening bumps `generation` so an older one does nothing.
		const onStill = (token: number) => {
			"worklet";
			if (generation.value !== token) return;
			markStraight();
		};

		const armStillness = () => {
			"worklet";
			if (!straighten) return;
			generation.value += 1;
			const token = generation.value;
			setTimeout(onStill, STILL_MS, token);
		};

		// Adds a point once the finger is far enough from the last.
		const extendStroke = (x: number, y: number) => {
			"worklet";
			const gap = MIN_POINT_GAP_PX / viewport.scale;
			points.modify((line) => {
				const dx = x - line[line.length - 2];
				const dy = y - line[line.length - 1];
				// Empty when it began before its first finger's touch-down reset it.
				if (line.length === 0 || dx * dx + dy * dy >= gap * gap) {
					line.push(x, y);
				}
				return line;
			});
		};

		// Waits for stillness afresh once the finger strays from where it last
		// started waiting.
		const restartStillness = (screenX: number, screenY: number) => {
			"worklet";
			const dx = screenX - anchorX.value;
			const dy = screenY - anchorY.value;
			if (dx * dx + dy * dy <= STILL_PX * STILL_PX) return;
			anchorX.value = screenX;
			anchorY.value = screenY;
			armStillness();
		};

		// On web, it activates at touch-down. Only touch-downs decide whether
		// it's cancelled: the first finger starts afresh, and fingers that land
		// together arrive as one touch-down, before the pan begins.
		return Gesture.Pan()
			.minDistance(0)
			.onTouchesDown((event) => {
				if (event.numberOfTouches === 1) cancelled.value = false;
				else cancel();
			})
			.onBegin((event) => {
				aside.value = standsAside?.(event.x, event.y) ?? false;
				straight.value = false;
				moved.value = false;
				strokeId.value += 1;
				points.value =
					cancelled.value || aside.value ? [] : toDocument(event.x, event.y);
				anchorX.value = event.x;
				anchorY.value = event.y;
				if (event.numberOfPointers > 1) cancel();
				else if (!cancelled.value && !aside.value) armStillness();
			})
			.onUpdate((event) => {
				if (event.numberOfPointers > 1) cancel();
				if (cancelled.value || aside.value) return;
				const [x, y] = toDocument(event.x, event.y);
				if (straighten && !moved.value) {
					moved.value = true;
					if (shiftHeld?.value) markStraight();
				}
				if (straight.value && points.value.length >= 2) {
					const line = points.value;
					points.value = straightStroke([line[0], line[1], x, y]);
					return;
				}
				extendStroke(x, y);
				if (straighten) restartStillness(event.x, event.y);
			})
			.onFinalize(() => {
				generation.value += 1;
				if (!cancelled.value && !aside.value) {
					scheduleOnRN(onStroke, points.value, strokeId.value);
				}
			});
	}, [
		viewport,
		points,
		strokeId,
		cancelled,
		aside,
		straight,
		moved,
		generation,
		anchorX,
		anchorY,
		onStroke,
		standsAside,
		straighten,
		shiftHeld,
		tick,
	]);
}
