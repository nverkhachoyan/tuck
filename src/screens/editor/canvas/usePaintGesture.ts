import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { type DocumentViewport, viewPointToDocument } from "../viewport";

// A point closer than this to the last one, in screen pixels, adds nothing
// anyone could see.
const MIN_POINT_GAP_PX = 1.5;

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
 */
export function usePaintGesture({
	viewport,
	points,
	strokeId,
	onStroke,
	standsAside = null,
}: {
	viewport: DocumentViewport;
	points: SharedValue<number[]>;
	strokeId: SharedValue<number>;
	onStroke: (points: number[], id: number) => void;
	// Whether one finger landing at a point is another gesture's. A worklet.
	standsAside?: ((screenX: number, screenY: number) => boolean) | null;
}) {
	const cancelled = useSharedValue(false);
	const aside = useSharedValue(false);

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
			points.value = [];
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
				strokeId.value += 1;
				points.value =
					cancelled.value || aside.value ? [] : toDocument(event.x, event.y);
				if (event.numberOfPointers > 1) cancel();
			})
			.onUpdate((event) => {
				if (event.numberOfPointers > 1) cancel();
				if (cancelled.value || aside.value) return;
				const [x, y] = toDocument(event.x, event.y);
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
			})
			.onFinalize(() => {
				if (!cancelled.value && !aside.value) {
					scheduleOnRN(onStroke, points.value, strokeId.value);
				}
			});
	}, [viewport, points, strokeId, cancelled, aside, onStroke, standsAside]);
}
