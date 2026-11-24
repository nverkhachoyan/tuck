import { Platform } from "react-native";
import { usePanGesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";
import { straightStroke } from "../layers/strokes";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

// A point closer than this to the last one, in screen pixels, adds nothing
// anyone could see.
const MIN_POINT_GAP_PX = 1.5;
// Holding a pen within this many screen pixels for `STILL_MS` straightens
// its stroke: the highlighter's before its first move, as a press. Once a
// stroke has moved, a hold must keep within `HOLD_PX`, so slow tracing, which
// covers about 8 pixels in that time, isn't taken for one.
const STILL_PX = 8;
const HOLD_PX = 3;
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
 * `onSegment`, a worklet, hears each piece of line as it's added: the first
 * point alone, then each new point with the one before it. An empty list
 * starts over, for a new stroke or a cancelled one.
 *
 * When `straighten` is set, a pen held still for half a second, once it has
 * moved, turns its stroke into the line from where it began. With
 * `straightenAtStart`, a hold before the first move does too (the
 * highlighter: hold, then drag a line). Shift held at its first move
 * (`shiftHeld`) does that from the start. It then follows as that line.
 *
 * `smoothing`, in screen points, is how far the line trails the finger: it
 * moves only once the finger pulls past that, so a wobble smaller than it
 * doesn't show (a "lazy brush"). The line catches up where the finger lifts.
 * A straightened line follows the finger.
 */
export function usePaintGesture({
	viewport,
	points,
	strokeId,
	onStroke,
	standsAside = null,
	straighten = false,
	straightenAtStart = false,
	smoothing = 0,
	shiftHeld = null,
	onSegment = null,
	enabled = true,
}: {
	viewport: DocumentViewport;
	points: SharedValue<number[]>;
	strokeId: SharedValue<number>;
	// When the finger landed and lifted, in milliseconds since the epoch.
	onStroke: (
		points: number[],
		id: number,
		startedAt: number,
		endedAt: number,
	) => void;
	// Whether one finger landing at a point is another gesture's. A worklet.
	standsAside?: ((screenX: number, screenY: number) => boolean) | null;
	// A pen: hold still, or hold Shift on web, and it draws a line.
	straighten?: boolean;
	straightenAtStart?: boolean;
	smoothing?: number;
	shiftHeld?: SharedValue<boolean> | null;
	onSegment?: ((points: number[]) => void) | null;
	enabled?: boolean;
}) {
	const cancelled = useSharedValue(false);
	const aside = useSharedValue(false);
	const straight = useSharedValue(false);
	const moved = useSharedValue(false);
	// Whether it has strayed from where it landed, so a hold is mid-stroke.
	const strayed = useSharedValue(false);
	const generation = useSharedValue(0);
	const anchorX = useSharedValue(0);
	const anchorY = useSharedValue(0);
	const startedAt = useSharedValue(0);
	// Where a smoothed line's tip is, in document space.
	const brushX = useSharedValue(0);
	const brushY = useSharedValue(0);
	// Where the finger last was, in document space, for a smoothed line to
	// end at.
	const fingerX = useSharedValue(0);
	const fingerY = useSharedValue(0);
	const tick = Platform.OS !== "web";

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
		onSegment?.([]);
	};

	const markStraight = () => {
		"worklet";
		if (straight.value || cancelled.value || aside.value) return;
		generation.value += 1;
		straight.value = true;
		// To the finger, which a smoothed line trails.
		const line = points.value;
		const away =
			line.length >= 2 &&
			(fingerX.value !== line[0] || fingerY.value !== line[1]);
		points.value = away
			? straightStroke([line[0], line[1], fingerX.value, fingerY.value])
			: line;
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
		const line = points.value;
		const lastX = line[line.length - 2];
		const lastY = line[line.length - 1];
		const dx = x - lastX;
		const dy = y - lastY;
		// Empty when it began before its first finger's touch-down reset it.
		const first = line.length === 0;
		if (!first && dx * dx + dy * dy < gap * gap) return;
		points.modify((value) => {
			value.push(x, y);
			return value;
		});
		onSegment?.(first ? [x, y] : [lastX, lastY, x, y]);
	};

	// Pulls the line's tip toward the finger, once it's more than
	// `smoothing` away, and adds it.
	const followFinger = (x: number, y: number) => {
		"worklet";
		if (smoothing <= 0) {
			extendStroke(x, y);
			return;
		}
		const lag = smoothing / viewport.scale;
		const dx = x - brushX.value;
		const dy = y - brushY.value;
		const distance = Math.hypot(dx, dy);
		if (distance <= lag) return;
		const pull = (distance - lag) / distance;
		brushX.value += dx * pull;
		brushY.value += dy * pull;
		extendStroke(
			Math.round(brushX.value * 100) / 100,
			Math.round(brushY.value * 100) / 100,
		);
	};

	// Waits for stillness afresh once the finger strays from where it last
	// started waiting: past `STILL_PX` from where it landed, then `HOLD_PX`.
	const restartStillness = (screenX: number, screenY: number) => {
		"worklet";
		const dx = screenX - anchorX.value;
		const dy = screenY - anchorY.value;
		const still = strayed.value ? HOLD_PX : STILL_PX;
		if (dx * dx + dy * dy <= still * still) return;
		strayed.value = true;
		anchorX.value = screenX;
		anchorY.value = screenY;
		armStillness();
	};

	// On web, it activates at touch-down. Only touch-downs decide whether
	// it's cancelled: the first finger starts afresh, and fingers that land
	// together arrive as one touch-down, before the pan begins.
	return usePanGesture({
		enabled,
		minDistance: 0,
		onTouchesDown: (event) => {
			if (event.numberOfTouches === 1) cancelled.value = false;
			else cancel();
		},
		onBegin: (event) => {
			aside.value = standsAside?.(event.x, event.y) ?? false;
			straight.value = false;
			moved.value = false;
			strayed.value = false;
			startedAt.value = Date.now();
			strokeId.value += 1;
			points.value =
				cancelled.value || aside.value ? [] : toDocument(event.x, event.y);
			onSegment?.([]);
			if (points.value.length > 0) onSegment?.(points.value);
			brushX.value = points.value[0] ?? 0;
			brushY.value = points.value[1] ?? 0;
			fingerX.value = brushX.value;
			fingerY.value = brushY.value;
			anchorX.value = event.x;
			anchorY.value = event.y;
			if (event.numberOfPointers > 1) cancel();
			else if (!cancelled.value && !aside.value && straightenAtStart) {
				armStillness();
			}
		},
		onUpdate: (event) => {
			if (event.numberOfPointers > 1) cancel();
			if (cancelled.value || aside.value) return;
			const [x, y] = toDocument(event.x, event.y);
			fingerX.value = x;
			fingerY.value = y;
			if (straighten && !moved.value) {
				moved.value = true;
				if (shiftHeld?.value) markStraight();
			}
			if (straight.value && points.value.length >= 2) {
				const line = points.value;
				points.value = straightStroke([line[0], line[1], x, y]);
				return;
			}
			followFinger(x, y);
			if (straighten) restartStillness(event.x, event.y);
		},
		onFinalize: () => {
			generation.value += 1;
			if (!cancelled.value && !aside.value) {
				if (smoothing > 0 && !straight.value && points.value.length > 0) {
					extendStroke(fingerX.value, fingerY.value);
				}
				scheduleOnRN(
					onStroke,
					points.value,
					strokeId.value,
					startedAt.value,
					Date.now(),
				);
			}
		},
	});
}
