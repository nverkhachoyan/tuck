import { Canvas, Group } from "@shopify/react-native-skia";
import { useCallback, useLayoutEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import type { EditorDocument } from "@/model/document";
import type { Transform } from "@/model/geometry";
import { EditorScene } from "./EditorScene";
import { findLayerAt } from "./hitTest";
import {
	syncLiveTransform,
	useLayerTransformGesture,
	useLiveTransform,
} from "./useLayerTransformGesture";
import { fitDocumentToView, viewPointToDocument } from "./viewport";

type EditorCanvasProps = {
	document: EditorDocument;
	selectedLayerId?: string | null;
	// Not drawn, e.g. while its text is open in the full-screen editor.
	hiddenLayerId?: string | null;
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
	hiddenLayerId = null,
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
			onSelectLayer(findLayerAt(document, point, scale));
		},
		[document, onSelectLayer, scale, viewport],
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
							<EditorScene
								document={document}
								selectedLayerId={selectedLayerId}
								hiddenLayerId={hiddenLayerId}
								viewScale={scale}
								live={live}
							/>
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
