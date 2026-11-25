import { useMemo } from "react";
import { Platform } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import {
	type Box,
	type GroupTransformChange,
	type Transform,
	transformAbout,
} from "../document/geometry";
import type { ResizeMode } from "./handleGeometry";

const MIN_LAYER_SCALE = 0.2;
const MAX_LAYER_SCALE = 8;

/** Virtual layer id held in `LiveTransform` while several layers are selected. */
export const SELECTION_GROUP_ID = "__selection_group__";

const NO_GROUP_IDS: readonly string[] = [];
const NO_TRANSFORMS: readonly Transform[] = [];

/**
 * High-frequency transform state for the selected layer or virtual selection
 * group.
 * - Gestures write here every frame (no React rerenders). The document only
 *   receives the final value when the gesture ends.
 * - While `activeId` matches a layer, that layer's node renders from these
 *   values instead of its document transform.
 * - While `activeId` is `SELECTION_GROUP_ID`, each layer in `groupIds` renders
 *   as `transformAbout` of its document transform, kept in step in
 *   `groupTransforms`, from `(groupStartX, groupStartY)` to the live values.
 * - `halfWidth` and `halfHeight` are its selection box, so the UI thread
 *   can find and draw its handles without laying out text.
 * - `resizeMode` says how the box resizes, with side handles.
 * - `guideX` and `guideY` are the document's lines a drag has snapped it
 *   onto, if any: a vertical line at x = `guideX`, a horizontal one at
 *   y = `guideY`.
 * - `heldId` is the layer (or `SELECTION_GROUP_ID`) a gesture is transforming,
 *   if any. The gesture owns its transform and box until it ends, so a sync
 *   from the document leaves them be.
 */
export type LiveTransform = {
	activeId: SharedValue<string | null>;
	heldId: SharedValue<string | null>;
	groupIds: SharedValue<readonly string[]>;
	groupTransforms: SharedValue<readonly Transform[]>;
	groupStartX: SharedValue<number>;
	groupStartY: SharedValue<number>;
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
	const groupIds = useSharedValue<readonly string[]>(NO_GROUP_IDS);
	const groupTransforms = useSharedValue<readonly Transform[]>(NO_TRANSFORMS);
	const groupStartX = useSharedValue(0);
	const groupStartY = useSharedValue(0);
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
			groupIds,
			groupTransforms,
			groupStartX,
			groupStartY,
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
			groupIds,
			groupTransforms,
			groupStartX,
			groupStartY,
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

function clearGroup(live: LiveTransform) {
	"worklet";
	live.groupIds.value = NO_GROUP_IDS;
	live.groupTransforms.value = NO_TRANSFORMS;
}

function applySync(
	live: LiveTransform,
	id: string | null,
	layer: LiveLayerState | undefined,
	groupIds: readonly string[],
	groupTransforms: readonly Transform[],
) {
	"worklet";
	const held =
		id !== null && id === live.heldId.value && id === live.activeId.value;
	if (!held) {
		if (id && layer) {
			writeLayer(live, layer);
			if (id === SELECTION_GROUP_ID) {
				live.groupStartX.value = layer.transform.x;
				live.groupStartY.value = layer.transform.y;
				live.groupIds.value = groupIds;
				live.groupTransforms.value = groupTransforms;
			} else {
				clearGroup(live);
			}
		} else {
			clearGroup(live);
		}
	}
	live.activeId.value = id;
}

/**
 * Points the live values at the selected layer or virtual selection group,
 * and its document transform and box, whenever either changes. It runs on
 * the UI thread, between a gesture's frames rather than during one, and
 * leaves a layer or group a gesture holds to the gesture. Otherwise a drag
 * that picked its layer on the UI thread would jump back when that selection
 * reached React.
 *
 * A group's members are synced with their document transforms
 * (`groupTransforms`, in `groupIds`' order), so that resetting the group's
 * change and moving its members land together: a member's derived value
 * picks up its new document transform only in a passive effect, after this
 * sync, and would otherwise draw the old transform with the change reset.
 */
export function syncLiveTransform(
	live: LiveTransform,
	id: string | null,
	layer: LiveLayerState | undefined,
	groupIds: readonly string[] = NO_GROUP_IDS,
	groupTransforms: readonly Transform[] = NO_TRANSFORMS,
) {
	// On web, worklets run on the JS thread anyway, and scheduling one there
	// waits for the next frame.
	if (Platform.OS === "web")
		applySync(live, id, layer, groupIds, groupTransforms);
	else scheduleOnUI(applySync, live, id, layer, groupIds, groupTransforms);
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
	clearGroup(live);
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

/** The group transform change from the group's starting center to the live values. */
export function liveGroupChange(live: LiveTransform): GroupTransformChange {
	"worklet";
	const startX = live.groupStartX.value;
	const startY = live.groupStartY.value;
	return {
		pivot: { x: startX, y: startY },
		dx: live.x.value - startX,
		dy: live.y.value - startY,
		scale: live.scaleX.value,
		rotation: live.rotation.value,
	};
}

// `transform` and `box` are the layer's own, from the document: while it's
// the active layer (or a member of the active group), the live values stand
// in for them. A group member moves from the transform the group was synced
// with, not `transform`, which may still be the one before a commit.
export function liveTransformOf(
	live: LiveTransform,
	id: string,
	transform: Transform,
): Transform {
	"worklet";
	const active = live.activeId.value;
	if (active === id) return readLiveTransform(live);
	if (active === SELECTION_GROUP_ID) {
		const index = live.groupIds.value.indexOf(id);
		if (index >= 0) {
			const base = live.groupTransforms.value[index] ?? transform;
			return transformAbout(base, liveGroupChange(live));
		}
	}
	return transform;
}

export function liveBoxOf(live: LiveTransform, id: string, box: Box): Box {
	"worklet";
	return live.activeId.value === id ? readLiveBox(live) : box;
}

export function clampScale(scale: number) {
	"worklet";
	return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, scale));
}
