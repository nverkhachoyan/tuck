import { Canvas, Group } from "@shopify/react-native-skia";
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { layerBounds } from "@/layers/layerBounds";
import type { EditorDocument, Layer } from "@/model/document";
import type { Transform } from "@/model/geometry";
import {
	type CanvasCursor,
	cursorForHandle,
	cursorStyle,
} from "./canvasCursor";
import { EditorScene } from "./EditorScene";
import { findLayerAt } from "./hitTest";
import { syncLiveTransform, useLiveTransform } from "./liveTransform";
import { handleUnder } from "./selectionHandles";
import { useLayerTransformGesture } from "./useLayerTransformGesture";
import { useTrackpadPinch } from "./useTrackpadPinch";
import { fitDocumentToView, viewPointToDocument } from "./viewport";

// Inside the canvas rather than around it, so layers past the photo's edge
// and their handles still have room to draw.
const PHOTO_INSET = 16;

type EditorCanvasProps = {
	document: EditorDocument;
	selectedLayer?: Layer;
	// Not drawn, e.g. while its text is open in the full-screen editor.
	hiddenLayerId?: string | null;
	onSelectLayer?: (id: string | null) => void;
	// A tap on the layer that's already selected (the editor opens its text).
	onTapSelectedLayer?: () => void;
	onCommitTransform?: (id: string, transform: Transform) => void;
	// Moves a layer by a document-space offset (see `nudgeSelection`).
	onNudgeLayer?: (id: string, dx: number, dy: number) => void;
};

export type EditorCanvasHandle = {
	flushPendingTransform: () => void;
	// Moves the selected layer by an on-screen distance, in pixels.
	nudgeSelection: (dx: number, dy: number) => void;
};

/**
 * Renders an EditorDocument fitted to the available space. A root group maps
 * the document's logical coordinates onto the container's screen size, so
 * layers live purely in document space and the same layer tree can later be
 * rendered at full resolution for export.
 *
 * All touch handling (tap-to-select, drag/pinch/rotate, the selection's
 * scale and rotate handles) is a single gesture on the canvas; selection is
 * resolved by hit-testing in document space. With a mouse, the cursor shows
 * what a press at the pointer would do.
 */
export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(
	function EditorCanvas(
		{
			document,
			selectedLayer,
			hiddenLayerId = null,
			onSelectLayer,
			onTapSelectedLayer,
			onCommitTransform,
			onNudgeLayer,
		},
		ref,
	) {
		const [size, setSize] = useState({ width: 0, height: 0 });
		const [cursor, setCursor] = useState<CanvasCursor>("default");
		const containerRef = useRef<View>(null);
		const live = useLiveTransform();

		const handleLayout = (event: LayoutChangeEvent) => {
			const { width, height } = event.nativeEvent.layout;
			setSize({ width, height });
		};

		// Stable between renders: the gesture captures these, and rebuilds when
		// they change.
		const documentSize = useMemo(
			() => ({ width: document.width, height: document.height }),
			[document.width, document.height],
		);
		const viewport = useMemo(
			() => fitDocumentToView(documentSize, size, PHOTO_INSET),
			[documentSize, size],
		);
		const { scale, offsetX, offsetY } = viewport;

		const selectedLayerId = selectedLayer?.id ?? null;

		// Keep the gesture-driven values in step with the selected layer: when the
		// selection changes, and when that layer does (a commit, undo, restyle).
		useLayoutEffect(() => {
			syncLiveTransform(
				live,
				selectedLayerId,
				selectedLayer?.transform,
				selectedLayer && layerBounds(selectedLayer),
			);
		}, [live, selectedLayer, selectedLayerId]);

		// The selected layer's handle under a point reported by the view.
		const handleAt = useCallback(
			(screenX: number, screenY: number) =>
				selectedLayer
					? handleUnder(
							selectedLayer.transform,
							layerBounds(selectedLayer),
							viewPointToDocument(viewport, { x: screenX, y: screenY }),
							scale,
						)
					: null,
			[selectedLayer, viewport, scale],
		);

		// Topmost selectable layer under a point reported by the view.
		const layerAt = useCallback(
			(screenX: number, screenY: number) =>
				findLayerAt(
					document,
					viewPointToDocument(viewport, { x: screenX, y: screenY }),
					scale,
				),
			[document, viewport, scale],
		);

		const handleTap = useCallback(
			(screenX: number, screenY: number) => {
				// A click on a handle that didn't become a drag does nothing, rather
				// than deselecting the layer that owns it.
				if (scale === 0 || handleAt(screenX, screenY)) return;
				const id = layerAt(screenX, screenY);
				if (id !== null && id === selectedLayerId) {
					onTapSelectedLayer?.();
				} else {
					onSelectLayer?.(id);
				}
			},
			[
				handleAt,
				layerAt,
				onSelectLayer,
				onTapSelectedLayer,
				scale,
				selectedLayerId,
			],
		);

		// Dragging a layer that isn't selected selects it first. Dragging empty
		// space keeps moving the current selection, which helps with small text.
		const handleDragStart = useCallback(
			(screenX: number, screenY: number) => {
				if (scale === 0 || !onSelectLayer) return false;
				const id = layerAt(screenX, screenY);
				if (id === null || id === selectedLayerId) return false;
				onSelectLayer(id);
				return true;
			},
			[layerAt, onSelectLayer, scale, selectedLayerId],
		);

		// What a press at the pointer would do: grab a handle, move a layer, or
		// nothing. Renders only when that changes, not on every pointer move.
		const handleHover = useCallback(
			(screenX: number, screenY: number) => {
				if (scale === 0) return;
				const handle = handleAt(screenX, screenY);
				if (handle && selectedLayer) {
					setCursor(cursorForHandle(handle, selectedLayer.transform.rotation));
				} else {
					setCursor(layerAt(screenX, screenY) === null ? "default" : "move");
				}
			},
			[handleAt, layerAt, scale, selectedLayer],
		);
		const handleHoverEnd = useCallback(() => setCursor("default"), []);

		const handleCommit = useCallback(
			(id: string, transform: Transform) => onCommitTransform?.(id, transform),
			[onCommitTransform],
		);

		const gesture = useLayerTransformGesture({
			live,
			viewport,
			documentSize,
			onTap: handleTap,
			onDragStart: handleDragStart,
			onCommit: handleCommit,
			onHover: handleHover,
			onHoverEnd: handleHoverEnd,
		});
		const flushPendingTransform = useTrackpadPinch({
			target: containerRef,
			live,
			onCommit: handleCommit,
		});
		const nudgeSelection = useCallback(
			(dx: number, dy: number) => {
				flushPendingTransform();
				if (!selectedLayer || scale === 0) return;
				onNudgeLayer?.(selectedLayer.id, dx / scale, dy / scale);
			},
			[flushPendingTransform, selectedLayer, scale, onNudgeLayer],
		);
		useImperativeHandle(
			ref,
			() => ({ flushPendingTransform, nudgeSelection }),
			[flushPendingTransform, nudgeSelection],
		);

		return (
			<GestureDetector gesture={gesture}>
				<View
					ref={containerRef}
					style={[styles.container, cursorStyle(cursor)]}
					onLayout={handleLayout}
				>
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
	},
);

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
});
