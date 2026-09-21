import { Group, useImage } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { TextLayerView, toTransformList } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { EditorDocument, ImageLayer, TextLayer } from "@/model/document";
import type { LiveTransform } from "./useLayerTransformGesture";

const SELECTION_STROKE_PX = 1.5;

type EditorSceneProps = {
	document: EditorDocument;
	selectedLayerId: string | null;
	// Screen pixels per document unit.
	viewScale: number;
	live: LiveTransform;
};

/**
 * The editor's counterpart to `ExportScene`: draws every layer in document
 * space, but loads images asynchronously and lets the selected layer follow
 * the live gesture values.
 */
export function EditorScene({
	document,
	selectedLayerId,
	viewScale,
	live,
}: EditorSceneProps) {
	return (
		<Group>
			{document.layers.map((layer) => {
				switch (layer.type) {
					case "image":
						return <AsyncImageLayer key={layer.id} layer={layer} />;
					case "text":
						return (
							<LiveTextLayer
								key={layer.id}
								layer={layer}
								viewScale={viewScale}
								live={live}
								selected={layer.id === selectedLayerId}
							/>
						);
					default:
						return assertNever(layer);
				}
			})}
		</Group>
	);
}

/** Draws nothing until the image has decoded. */
function AsyncImageLayer({ layer }: { layer: ImageLayer }) {
	const image = useImage(layer.uri);
	if (!image) return null;
	return <ImageLayerView layer={layer} image={image} />;
}

/** While a layer is being dragged, the gesture-driven values win over the document. */
function LiveTextLayer({
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
