import { useMemo } from "react";
import { Platform } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import type { Box, Transform } from "@/model/geometry";

const MIN_LAYER_SCALE = 0.2;
const MAX_LAYER_SCALE = 8;

/**
 * High-frequency transform state for the selected layer. Gestures write here
 * every frame (no React rerenders); the document only receives the final
 * value when the gesture ends. While `activeId` matches a layer, that layer's
 * node renders from these values instead of its document transform.
 * `halfWidth`/`halfHeight` are its selection box, so the UI thread can find
 * and draw its handles without laying out text. `guideX`/`guideY` are the
 * document's lines a drag has snapped it onto, if any: a vertical line at
 * x = `guideX`, a horizontal one at y = `guideY`.
 *
 * `heldId` is the layer a gesture is transforming, if any. The gesture owns
 * its transform until it ends, so a sync from the document leaves it be.
 */
export type LiveTransform = {
	activeId: SharedValue<string | null>;
	heldId: SharedValue<string | null>;
	x: SharedValue<number>;
	y: SharedValue<number>;
	scale: SharedValue<number>;
	rotation: SharedValue<number>;
	halfWidth: SharedValue<number>;
	halfHeight: SharedValue<number>;
	guideX: SharedValue<number | null>;
	guideY: SharedValue<number | null>;
};

export function useLiveTransform(): LiveTransform {
	const activeId = useSharedValue<string | null>(null);
	const heldId = useSharedValue<string | null>(null);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const scale = useSharedValue(1);
	const rotation = useSharedValue(0);
	const halfWidth = useSharedValue(0);
	const halfHeight = useSharedValue(0);
	const guideX = useSharedValue<number | null>(null);
	const guideY = useSharedValue<number | null>(null);
	return useMemo(
		() => ({
			activeId,
			heldId,
			x,
			y,
			scale,
			rotation,
			halfWidth,
			halfHeight,
			guideX,
			guideY,
		}),
		[
			activeId,
			heldId,
			x,
			y,
			scale,
			rotation,
			halfWidth,
			halfHeight,
			guideX,
			guideY,
		],
	);
}

function writeLayer(
	live: LiveTransform,
	transform: Transform | null,
	box: Box,
) {
	"worklet";
	if (transform) {
		live.x.value = transform.x;
		live.y.value = transform.y;
		live.scale.value = transform.scaleX;
		live.rotation.value = transform.rotation;
	}
	live.halfWidth.value = box.halfWidth;
	live.halfHeight.value = box.halfHeight;
}

function applySync(
	live: LiveTransform,
	id: string | null,
	transform: Transform | undefined,
	box: Box | undefined,
) {
	"worklet";
	if (id && transform && box) {
		const held = id === live.heldId.value && id === live.activeId.value;
		writeLayer(live, held ? null : transform, box);
	}
	live.activeId.value = id;
}

/**
 * Points the live values at the selected layer, and its document transform
 * and box, whenever either changes. It runs on the UI thread, between a
 * gesture's frames rather than during one, and leaves the transform of a
 * layer a gesture holds to the gesture. Otherwise a drag that picked its
 * layer on the UI thread would jump back when that selection reached React.
 */
export function syncLiveTransform(
	live: LiveTransform,
	id: string | null,
	transform: Transform | undefined,
	box: Box | undefined,
) {
	// On web, worklets run on the JS thread anyway, and scheduling one there
	// waits for the next frame.
	if (Platform.OS === "web") applySync(live, id, transform, box);
	else scheduleOnUI(applySync, live, id, transform, box);
}

/**
 * Hands the live values to a layer a gesture picked on the UI thread, ahead
 * of the selection reaching React, and holds it for that gesture.
 */
export function holdLayer(
	live: LiveTransform,
	id: string,
	transform: Transform,
	box: Box,
) {
	"worklet";
	writeLayer(live, transform, box);
	live.activeId.value = id;
	live.heldId.value = id;
}

/** The live values as a document transform (layers scale uniformly). */
export function readLiveTransform(live: LiveTransform): Transform {
	"worklet";
	return {
		x: live.x.value,
		y: live.y.value,
		scaleX: live.scale.value,
		scaleY: live.scale.value,
		rotation: live.rotation.value,
	};
}

export function readLiveBox(live: LiveTransform): Box {
	"worklet";
	return { halfWidth: live.halfWidth.value, halfHeight: live.halfHeight.value };
}

export function clampScale(scale: number) {
	"worklet";
	return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, scale));
}
