import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
	type DerivedValue,
	type SharedValue,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticTick } from "@/platform/haptics";
import { handleMetrics, hasFinePointer } from "../../canvas/handleMetrics";
import {
	type DocumentViewport,
	viewRectToDocument,
} from "../../canvas/viewport";
import type { Rect, Size } from "../../document/geometry";
import { type CropHandle, cropHandleAt, dragCrop } from "./cropDrag";
import { type CropState, cropAngle } from "./cropGeometry";

// In screen pixels: the smallest the box gets, and how close its edges come
// to the photo's before snapping.
const MIN_BOX_PX = 48;
const SNAP_PX = 10;

/**
 * Dragging the crop box's corners and sides resizes it, and dragging inside
 * it moves it, in crop space (see `cropGeometry.ts`). The box stays on
 * screen; `onEnd` runs after each drag, so the view can refit to it. With a
 * mouse, hovering reports the handle under the pointer, for cursors.
 */
export function useCropGesture({
	crop,
	viewport,
	viewSize,
	photo,
	ratio,
	dragging,
	onEnd,
	onHover,
}: {
	crop: SharedValue<CropState>;
	viewport: DerivedValue<DocumentViewport>;
	viewSize: Size;
	photo: Size;
	ratio: SharedValue<number | null>;
	dragging: SharedValue<boolean>;
	onEnd: () => void;
	onHover: (handle: CropHandle | null) => void;
}) {
	const handle = useSharedValue<CropHandle | null>(null);
	const startBox = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0 });
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const snapped = useSharedValue(0);

	return useMemo(() => {
		// The box's handle under a point on screen.
		const handleAt = (x: number, y: number) => {
			"worklet";
			const { scale, offsetX, offsetY } = viewport.value;
			const { box } = crop.value;
			return cropHandleAt(
				{
					left: box.x * scale + offsetX,
					top: box.y * scale + offsetY,
					right: (box.x + box.width) * scale + offsetX,
					bottom: (box.y + box.height) * scale + offsetY,
				},
				{ x, y },
				handleMetrics.hitRadius,
			);
		};

		// One finger: a second would move the reported point to between them.
		const pan = Gesture.Pan()
			.minDistance(0)
			.maxPointers(1)
			.onBegin((event) => {
				handle.value = handleAt(event.x, event.y);
				startBox.value = crop.value.box;
				startX.value = event.x;
				startY.value = event.y;
				snapped.value = 0;
			})
			.onStart(() => {
				if (handle.value !== null) dragging.value = true;
			})
			.onUpdate((event) => {
				const grabbed = handle.value;
				if (grabbed === null) return;
				const { scale } = viewport.value;
				const state = crop.value;
				const result = dragCrop(
					startBox.value,
					grabbed,
					(event.x - startX.value) / scale,
					(event.y - startY.value) / scale,
					{
						photo,
						angle: cropAngle(state),
						ratio: ratio.value,
						minSize: MIN_BOX_PX / scale,
						// The crop tool fits the content with an inset around it.
						// Using the whole visible view here leaves that inset as room
						// to drag an edge outward before the view refits after the
						// gesture.
						bounds: viewRectToDocument(viewport.value, viewSize),
						tolerance: SNAP_PX / scale,
					},
				);
				// Ticks as a snap lands, not while it holds.
				if (result.snapped & ~snapped.value) scheduleOnRN(hapticTick);
				snapped.value = result.snapped;
				crop.value = { ...state, box: result.box };
			})
			.onFinalize(() => {
				if (handle.value === null) return;
				handle.value = null;
				dragging.value = false;
				scheduleOnRN(onEnd);
			});

		const hover = Gesture.Hover()
			.enabled(hasFinePointer)
			.onBegin((event) => {
				scheduleOnRN(onHover, handleAt(event.x, event.y));
			})
			.onUpdate((event) => {
				scheduleOnRN(onHover, handleAt(event.x, event.y));
			})
			.onEnd(() => {
				scheduleOnRN(onHover, null);
			});

		return Gesture.Simultaneous(hover, pan);
	}, [
		crop,
		viewport,
		viewSize,
		photo,
		ratio,
		dragging,
		onEnd,
		onHover,
		handle,
		startBox,
		startX,
		startY,
		snapped,
	]);
}
