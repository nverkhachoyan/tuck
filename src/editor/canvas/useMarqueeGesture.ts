import { usePanGesture } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { rectFromCorners } from "../document/geometry";
import { type LayerTarget, layersInRect } from "./hitTest";
import { type DocumentViewport, viewPointToDocument } from "./viewport";

// Above the tap gesture's 10px maxDistance so a gesture is cleanly either a
// tap or a box drag, never both.
const MIN_DRAG_DISTANCE = 11;

/** The Select tool's drag box in screen pixels, driven on the UI thread. */
export type LiveMarquee = {
	active: SharedValue<boolean>;
	x: SharedValue<number>;
	y: SharedValue<number>;
	width: SharedValue<number>;
	height: SharedValue<number>;
};

/**
 * Drags out a selection box off the current selection and reports the layers
 * caught when the finger lifts (`onFinish`).
 * - Stands aside where `standsAside` says the selection's own drag takes the
 *   finger (on a selected layer or its handles).
 * - Cancels without selecting if a second finger lands (pinch/rotate/undo).
 * - Draws in screen pixels through `marqueeBox`, using plain shared numbers so
 *   no Skia path is allocated per frame.
 */
export function useMarqueeGesture({
	viewport,
	layers,
	replaces,
	standsAside = null,
	onFinish,
	enabled = false,
}: {
	viewport: DocumentViewport;
	layers: SharedValue<readonly LayerTarget[]>;
	// Whether the box replaces the selection rather than adding to it.
	replaces: SharedValue<boolean>;
	standsAside?: ((screenX: number, screenY: number) => boolean) | null;
	onFinish: (ids: readonly string[], replace: boolean) => void;
	enabled?: boolean;
}) {
	const active = useSharedValue(false);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const width = useSharedValue(0);
	const height = useSharedValue(0);
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const aside = useSharedValue(false);
	const canceled = useSharedValue(false);

	const updateBox = (currentX: number, currentY: number) => {
		"worklet";
		x.value = Math.min(startX.value, currentX);
		y.value = Math.min(startY.value, currentY);
		width.value = Math.abs(currentX - startX.value);
		height.value = Math.abs(currentY - startY.value);
	};

	const marqueeGesture = usePanGesture({
		enabled,
		minDistance: MIN_DRAG_DISTANCE,
		onTouchesDown: (event) => {
			if (event.numberOfTouches > 1) {
				canceled.value = true;
				active.value = false;
			}
		},
		onBegin: (event) => {
			canceled.value = event.numberOfPointers > 1;
			aside.value = standsAside?.(event.x, event.y) ?? false;
			startX.value = event.x;
			startY.value = event.y;
		},
		onActivate: (event) => {
			if (aside.value || canceled.value || event.numberOfPointers > 1) {
				canceled.value = true;
				active.value = false;
				return;
			}
			updateBox(event.x, event.y);
			active.value = true;
		},
		onUpdate: (event) => {
			if (aside.value || canceled.value) return;
			if (event.numberOfPointers > 1) {
				canceled.value = true;
				active.value = false;
				return;
			}
			updateBox(event.x, event.y);
		},
		onDeactivate: (event) => {
			if (active.value && !canceled.value && !aside.value && !event.canceled) {
				const topLeft = viewPointToDocument(viewport, {
					x: x.value,
					y: y.value,
				});
				const bottomRight = viewPointToDocument(viewport, {
					x: x.value + width.value,
					y: y.value + height.value,
				});
				const caught = layersInRect(
					layers.value,
					rectFromCorners(topLeft, bottomRight),
				);
				scheduleOnRN(onFinish, caught, replaces.value);
			}
			active.value = false;
		},
		onFinalize: () => {
			active.value = false;
			aside.value = false;
			canceled.value = false;
		},
	});

	const marqueeBox: LiveMarquee = { active, x, y, width, height };
	return { marqueeGesture, marqueeBox };
}
