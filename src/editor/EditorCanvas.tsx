import { Canvas, Group } from "@shopify/react-native-skia";
import { useCallback, useLayoutEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import type { EditorDocument } from "@/document/document";
import { hitTestBox, type Transform } from "@/document/geometry";
import { measureTextLayer, selectionPadding } from "@/layers/textLayerMetrics";
import { assertNever } from "@/utils/assertNever";
import { ImageLayerNode } from "./ImageLayerNode";
import { TextLayerNode } from "./TextLayerNode";
import {
	syncLiveTransform,
	useLayerTransformGesture,
	useLiveTransform,
} from "./useLayerTransformGesture";
import { fitDocumentToView, viewPointToDocument } from "./viewport";

// Minimum comfortable touch padding around text, in screen pixels.
const HIT_PADDING_PX = 14;

type EditorCanvasProps = {
	document: EditorDocument;
	selectedLayerId?: string | null;
	onSelectLayer?: (id: string | null) => void;
	onCommitTransform?: (transform: Transform) => void;
};

/**
 * Renders an EditorDocument fitted to the available space. A root group maps
 * the document's logical coordinates onto the container's screen size, so
 * layers live purely in document space and the same layer tree can later be
 * rendered at full resolution for export.
 *
 * All touch handling (tap-to-select, drag/pinch/rotate) is a single gesture
 * on the canvas; selection is resolved by hit-testing in document space.
 */
export function EditorCanvas({
	document,
	selectedLayerId = null,
	onSelectLayer,
	onCommitTransform,
}: EditorCanvasProps) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const live = useLiveTransform();

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
	};

	const viewport = fitDocumentToView(document, size);
	const { scale, offsetX, offsetY } = viewport;

	// Keep the gesture-driven values in step with whichever layer is selected,
	// however it got selected (tap, add, delete).
	useLayoutEffect(() => {
		const layer = document.layers.find((l) => l.id === selectedLayerId);
		syncLiveTransform(live, layer ? layer.id : null, layer?.transform);
		// While a gesture runs, the live values are the source of truth. When the
		// layer list changes, synchronize it with the latest document state.
	}, [document.layers, live, selectedLayerId]);

	const handleTap = useCallback(
		(screenX: number, screenY: number) => {
			if (!onSelectLayer || scale === 0) return;
			const point = viewPointToDocument(viewport, {
				x: screenX,
				y: screenY,
			});
			// Topmost layer first.
			for (let i = document.layers.length - 1; i >= 0; i--) {
				const layer = document.layers[i];
				if (layer.type !== "text") continue;
				const { width, height } = measureTextLayer(layer);
				const hitPad = Math.max(
					selectionPadding(layer),
					HIT_PADDING_PX / (scale * layer.transform.scaleX),
				);
				if (
					hitTestBox(
						layer.transform,
						width / 2 + hitPad,
						height / 2 + hitPad,
						point,
					)
				) {
					onSelectLayer(layer.id);
					return;
				}
			}
			onSelectLayer(null);
		},
		[document.layers, onSelectLayer, scale, viewport],
	);

	const gesture = useLayerTransformGesture({
		live,
		viewScale: scale || 1,
		onTap: handleTap,
		onCommit: useCallback(
			(transform) => onCommitTransform?.(transform),
			[onCommitTransform],
		),
	});

	return (
		<GestureDetector gesture={gesture}>
			<View style={styles.container} onLayout={handleLayout}>
				<Canvas style={styles.canvas}>
					{scale > 0 && (
						<Group
							transform={[
								{ translateX: offsetX },
								{ translateY: offsetY },
								{ scale },
							]}
						>
							{document.layers.map((layer) => {
								switch (layer.type) {
									case "image":
										return <ImageLayerNode key={layer.id} layer={layer} />;
									case "text":
										return (
											<TextLayerNode
												key={layer.id}
												layer={layer}
												viewScale={scale}
												live={live}
												selected={layer.id === selectedLayerId}
											/>
										);
									default:
										return assertNever(layer);
								}
							})}
						</Group>
					)}
				</Canvas>
			</View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
});
