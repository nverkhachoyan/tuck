import { useDerivedValue } from "react-native-reanimated";
import { TextLayerView, toTransformList } from "@/layers/TextLayerView";
import type { TextLayer } from "@/model/document";
import type { LiveTransform } from "./useLayerTransformGesture";

const SELECTION_STROKE_PX = 1.5;

/**
 * Editor-canvas wrapper around `TextLayerView`: while a layer is being
 * dragged, the gesture-driven shared values win over the document.
 */
export function TextLayerNode({
	layer,
	viewScale,
	live,
	selected,
}: {
	layer: TextLayer;
	viewScale: number;
	live: LiveTransform;
	selected: boolean;
}) {
	const transform = useDerivedValue(() => {
		const active = live.activeId.value === layer.id;
		const t = layer.transform;
		return toTransformList({
			x: active ? live.x.value : t.x,
			y: active ? live.y.value : t.y,
			rotation: active ? live.rotation.value : t.rotation,
			scaleX: active ? live.scale.value : t.scaleX,
			scaleY: active ? live.scale.value : t.scaleY,
		});
	}, [layer.id, layer.transform]);

	// Keep the selection outline a constant on-screen thickness at any scale.
	const selectionStroke = useDerivedValue(() => {
		const scale =
			live.activeId.value === layer.id
				? live.scale.value
				: layer.transform.scaleX;
		return SELECTION_STROKE_PX / (viewScale * scale);
	}, [layer.id, layer.transform, viewScale]);

	return (
		<TextLayerView
			layer={layer}
			transform={transform}
			selectionStroke={selected ? selectionStroke : undefined}
		/>
	);
}
