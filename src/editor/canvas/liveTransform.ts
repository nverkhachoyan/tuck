import { useMemo } from "react";
import { Platform } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import type { Box, Transform } from "../document/geometry";
import type { ResizeMode } from "./handleGeometry";

const MIN_LAYER_SCALE = 0.2;
const MAX_LAYER_SCALE = 8;

/**
 * High-frequency transform state for the selected layer.
 * - Gestures write here every frame (no React rerenders). The document only
 *   receives the final value when the gesture ends.
 * - While `activeId` matches a layer, that layer's node renders from these
 *   values instead of its document transform.
 * - `halfWidth` and `halfHeight` are its selection box, so the UI thread
 *   can find and draw its handles without laying out text.
 * - `resizeMode` says how the box resizes, with side handles.
 * - `guideX` and `guideY` are the document's lines a drag has snapped it
 *   onto, if any: a vertical line at x = `guideX`, a horizontal one at
 *   y = `guideY`.
 * - `heldId` is the layer a gesture is transforming, if any. The gesture
 *   owns its transform and box until it ends, so a sync from the document
 *   leaves them be.
 */
export type LiveTransform = {
	activeId: SharedValue<string | null>;
	heldId: SharedValue<string | null>;
	x: SharedValue<number>;
	y: SharedValue<number>;
	scaleX: SharedValue<number>;
	scaleY: SharedValue<number>;
	rotation: SharedValue<number>;
	halfWidth: SharedValue<number>;
	halfHeight: SharedValue<number>;
	resizeMode: SharedValue<ResizeMode>;
	guideX: SharedValue<number | null>;
	guideY: SharedValue<number | null>;
};

export function useLiveTransform(): LiveTransform {
	const activeId = useSharedValue<string | null>(null);
	const heldId = useSharedValue<string | null>(null);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const scaleX = useSharedValue(1);
	const scaleY = useSharedValue(1);
	const rotation = useSharedValue(0);
	const halfWidth = useSharedValue(0);
	const halfHeight = useSharedValue(0);
	const resizeMode = useSharedValue<ResizeMode>("none");
	const guideX = useSharedValue<number | null>(null);
	const guideY = useSharedValue<number | null>(null);
	return useMemo(
		() => ({
			activeId,
			heldId,
			x,
			y,
			scaleX,
			scaleY,
			rotation,
			halfWidth,
			halfHeight,
			resizeMode,
			guideX,
			guideY,
		}),
		[
			activeId,
			heldId,
			x,
			y,
			scaleX,
			scaleY,
			rotation,
			halfWidth,
			halfHeight,
			resizeMode,
			guideX,
			guideY,
		],
	);
}

/** What the live values take from the layer they follow. */
export type LiveLayerState = {
	transform: Transform;
	box: Box;
	resizeMode: ResizeMode;
};

function writeLayer(live: LiveTransform, layer: LiveLayerState) {
	"worklet";
	live.x.value = layer.transform.x;
	live.y.value = layer.transform.y;
	live.scaleX.value = layer.transform.scaleX;
	live.scaleY.value = layer.transform.scaleY;
	live.rotation.value = layer.transform.rotation;
	live.halfWidth.value = layer.box.halfWidth;
	live.halfHeight.value = layer.box.halfHeight;
	live.resizeMode.value = layer.resizeMode;
}

function applySync(
	live: LiveTransform,
	id: string | null,
	layer: LiveLayerState | undefined,
) {
	"worklet";
	if (id && layer) {
		const held = id === live.heldId.value && id === live.activeId.value;
		if (!held) writeLayer(live, layer);
	}
	live.activeId.value = id;
}

/**
 * Points the live values at the selected layer, and its document transform
 * and box, whenever either changes. It runs on the UI thread, between a
 * gesture's frames rather than during one, and leaves a layer a gesture
 * holds to the gesture. Otherwise a drag that picked its layer on the UI
 * thread would jump back when that selection reached React.
 */
export function syncLiveTransform(
	live: LiveTransform,
	id: string | null,
	layer: LiveLayerState | undefined,
) {
	// On web, worklets run on the JS thread anyway, and scheduling one there
	// waits for the next frame.
	if (Platform.OS === "web") applySync(live, id, layer);
	else scheduleOnUI(applySync, live, id, layer);
}

/**
 * Hands the live values to a layer a gesture picked on the UI thread, ahead
 * of the selection reaching React, and holds it for that gesture.
 */
export function holdLayer(
	live: LiveTransform,
	id: string,
	layer: LiveLayerState,
) {
	"worklet";
	writeLayer(live, layer);
	live.activeId.value = id;
	live.heldId.value = id;
}

export function readLiveTransform(live: LiveTransform): Transform {
	"worklet";
	return {
		x: live.x.value,
		y: live.y.value,
		scaleX: live.scaleX.value,
		scaleY: live.scaleY.value,
		rotation: live.rotation.value,
	};
}

export function readLiveBox(live: LiveTransform): Box {
	"worklet";
	return { halfWidth: live.halfWidth.value, halfHeight: live.halfHeight.value };
}

// `transform` and `box` are the layer's own, from the document: while it's
// the active layer, the live values stand in for them.
export function liveTransformOf(
	live: LiveTransform,
	id: string,
	transform: Transform,
): Transform {
	"worklet";
	return live.activeId.value === id ? readLiveTransform(live) : transform;
}

export function liveBoxOf(live: LiveTransform, id: string, box: Box): Box {
	"worklet";
	return live.activeId.value === id ? readLiveBox(live) : box;
}

export function clampScale(scale: number) {
	"worklet";
	return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, scale));
}
