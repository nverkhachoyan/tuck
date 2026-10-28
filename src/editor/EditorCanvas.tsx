import { Canvas, Group } from "@shopify/react-native-skia";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import type { EditorDocument } from "@/model/document";
import type { Box, Point, Rect, Transform } from "@/model/geometry";
import type { Layer } from "@/model/layers/layer";
import { type TextSelection, withPlaceholder } from "@/model/textEditing";
import { Surface } from "@/ui/Surface";
import { colors, space, typography } from "@/ui/theme";
import { cursorStyle } from "./canvas/canvasCursor";
import { cutImageId, type ToolStroke } from "./canvas/canvasTool";
import { FitButton } from "./canvas/FitButton";
import { handleUnder } from "./canvas/handleMetrics";
import { findLayerAt, hitsLayer, type LayerTarget } from "./canvas/hitTest";
import { layerBounds } from "./canvas/layerBounds";
import { layerTargets, resizeMode } from "./canvas/layerTargets";
import {
	type LiveTransform,
	readLiveBox,
	readLiveTransform,
	syncLiveTransform,
	useLiveTransform,
} from "./canvas/liveTransform";
import { SelectionBarFrame } from "./canvas/SelectionBarFrame";
import { useCanvasCursor } from "./canvas/useCanvasCursor";
import { useCanvasTap } from "./canvas/useCanvasTap";
import { useCanvasZoom } from "./canvas/useCanvasZoom";
import { useLayerTransformGesture } from "./canvas/useLayerTransformGesture";
import { useShiftHeld } from "./canvas/useShiftHeld";
import { useToolStroke } from "./canvas/useToolStroke";
import { useViewGesture } from "./canvas/useViewGesture";
import {
	type DocumentViewport,
	type ViewFrame,
	viewPointToDocument,
} from "./canvas/viewport";
import {
	type CanvasInput,
	inputRules,
	outlinedLayerFor,
} from "./canvasInputFor";
import { EditorScene } from "./EditorScene";
import type { TextEditState } from "./editorMode";
import { useKeepTextFocus } from "./text/useKeepTextFocus";
import { useTextEditGesture } from "./text/useTextEditGesture";
import type { LiveAdjustment } from "./tools/adjust/useAdjustTool";
import { useDialDragGesture } from "./tools/adjust/useDialDragGesture";
import type { DetectionOverlayRegion } from "./tools/find/DetectionOutline";
import { useFindTap } from "./tools/find/useFindTap";

// Inside the canvas rather than around it, so layers past the photo's edge
// and their handles still have room to draw.
const PHOTO_INSET = 12;
const SELECT: CanvasInput = { type: "select" };

// The selection's live handle under a document point. The drags below share
// it, and each still decides for itself whether the layer is hit.
function liveHandleAt(
	live: LiveTransform,
	viewport: DocumentViewport,
	point: Point,
) {
	"worklet";
	return handleUnder(
		readLiveTransform(live),
		readLiveBox(live),
		live.resizeMode.value,
		point,
		viewport.scale,
	);
}
const NO_DETECTIONS: readonly DetectionOverlayRegion[] = [];

type EditorCanvasProps = {
	ref?: Ref<EditorCanvasHandle>;
	document: EditorDocument;
	selectedLayer?: Layer;
	// What input does (see `CanvasInput`). With no tool or text, it selects
	// and transforms layers.
	input?: CanvasInput;
	// Text being edited in place (see `TextEditState`), drawn as typed. With
	// an `editText` input, presses on it place the caret or select, and a tap
	// off it finishes.
	textEdit?: TextEditState | null;
	onTextSelect?: (selection: TextSelection) => void;
	onTextEditDone?: () => void;
	onSelectLayer?: (id: string | null) => void;
	// A tap on the layer that's already selected, in document space (the
	// editor opens its text there).
	onTapSelectedLayer?: (point: Point) => void;
	onCommitTransform?: (id: string, transform: Transform) => void;
	// A redaction's box resized by its handles, which moves its center too.
	onResizeBox?: (
		id: string,
		transform: Transform,
		width: number,
		height: number,
	) => void;
	// Moves a layer by a document-space offset (see `nudgeSelection`).
	onNudgeLayer?: (id: string, dx: number, dy: number) => void;
	// A finished stroke with a tool, in document space: a brush's points, a
	// redaction's box, a shape, or where a tap, or a drag's end, picks a color
	// or the subject to cut out.
	onToolStroke?: (stroke: ToolStroke) => void;
	// A canvas-tool gesture has finished. A tool can use this to put away its
	// options after the same gesture has drawn, rather than blocking the draw.
	onToolInteractionEnd?: () => void;
	// A tap away from what the tool works on, while painting, finding, or
	// adjusting. The editor puts the tool down, and the tap then selects what's
	// under it, as it would without a tool.
	onTapAway?: () => void;
	// While set, this image's adjustments are being changed, drawn live. With
	// a `dial` input, it's outlined when there are other images.
	adjusting?: LiveAdjustment | null;
	// How much of the view's bottom is covered by panels floating over it,
	// and by the keyboard they ride on. The document fits above them, and
	// what's past its edges shows under.
	bottomInset?: number;
	// How much of each side is covered, as by a wide screen's tool rail and
	// inspector.
	leftInset?: number;
	rightInset?: number;
	// Actions for the selected layer, floating by it while it can be moved.
	selectionBar?: ReactNode;
};

export type EditorCanvasHandle = {
	// Moves the selected layer by an on-screen distance, in pixels.
	nudgeSelection: (dx: number, dy: number) => void;
	// Zooms about the middle of the view, or back to the fit, easing there.
	zoom: (to: "in" | "out" | "fit") => void;
	// Zooms to show a document rectangle, with some room around it.
	zoomToArea: (rect: Rect) => void;
	// The part of the document in view, in document space, where a new layer
	// goes.
	visibleArea: () => Rect;
};

/**
 * Renders an EditorDocument fitted to the available space. A root group maps
 * the document's logical coordinates onto the container's screen size, so
 * layers live purely in document space and the same layer tree can later be
 * rendered at full resolution for export.
 *
 * The view zooms into the fit (see `ViewZoom`): with two fingers wherever
 * they wouldn't transform the selected layer (see `useViewGesture`), with a
 * trackpad pinch or the wheel on web (`useWheelZoom`), by key through
 * `zoom`, and with a double tap on nothing to select, which zooms in there
 * or back out. While zoomed in, one finger pans it too, unless it lands on
 * the selected layer or its handles, and so does it anywhere while
 * finding. While zoomed, a Fit button returns to the fit. A crop, which
 * changes the document's size, starts afresh at the fit.
 *
 * All touch handling (tap-to-select, drag/pinch/rotate, the selection's
 * scale, resize, and rotate handles) is a single gesture on the canvas;
 * selection is resolved by hit-testing in document space, against
 * `layerTargets`, which the UI thread shares so a drag can pick its layer
 * there. With a mouse, the cursor is `useCanvasCursor`.
 *
 * A tool's stroke is `useToolStroke`, handed to `onToolStroke` once it's
 * finished. The selection then holds still, and
 * only a redaction's or a shape's is outlined, to show what the tool's style
 * changes. Dragging out a box or a shape, a tap picks the one to change, or
 * none, and the one picked, or just drawn, shows its handles: a drag from on
 * it or them moves or resizes it, and one from anywhere else draws another.
 * While adjusting, a sideways drag anywhere turns the adjustment's dial
 * (`input.drag`).
 *
 * A tap away from what a tool works on calls `onTapAway`: off the document
 * while painting, off the searched image while finding, and anywhere while
 * adjusting. A drag from off the document still paints.
 *
 * `selectionBar` floats by a layer that can be moved, following it on the
 * UI thread, and steps aside while a gesture moves it.
 */
export function EditorCanvas({
	ref,
	document,
	selectedLayer,
	input = SELECT,
	textEdit = null,
	onTextSelect,
	onTextEditDone,
	onSelectLayer,
	onTapSelectedLayer,
	onCommitTransform,
	onResizeBox,
	onNudgeLayer,
	onToolStroke,
	onToolInteractionEnd,
	onTapAway,
	adjusting = null,
	bottomInset = 0,
	leftInset = 0,
	rightInset = 0,
	selectionBar,
}: EditorCanvasProps) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [imageFailed, setImageFailed] = useState(false);
	const containerRef = useRef<View>(null);
	const live = useLiveTransform();
	const aspectLocked = useShiftHeld();
	const editingText = textEdit !== null;
	useKeepTextFocus(containerRef, editingText);

	const handleImageError = useCallback((error: unknown) => {
		console.warn("Couldn't load an image layer", error);
		setImageFailed(true);
	}, []);

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
	const frame = useMemo<ViewFrame>(
		() => ({
			documentSize,
			area: {
				x: leftInset,
				y: 0,
				width: size.width - leftInset - rightInset,
				height: size.height - bottomInset,
			},
			inset: PHOTO_INSET,
		}),
		[documentSize, size, bottomInset, leftInset, rightInset],
	);
	const {
		zoom,
		viewport,
		shown,
		commitViewport,
		tapOnNothing,
		zoomView,
		zoomToArea,
		visibleArea,
	} = useCanvasZoom(frame, containerRef);
	const { scale } = viewport;
	const shownTransform = useDerivedValue(() => [
		{ translateX: shown.offsetX.value },
		{ translateY: shown.offsetY.value },
		{ scale: shown.scale.value },
	]);

	const targets = useMemo(
		() => (scale > 0 ? layerTargets(document, scale) : []),
		[document, scale],
	);
	const sharedTargets = useSharedValue<readonly LayerTarget[]>([]);
	useLayoutEffect(() => {
		sharedTargets.value = targets;
	}, [sharedTargets, targets]);

	const selectedLayerId = selectedLayer?.id ?? null;
	const rules = inputRules(input, zoom !== null, selectedLayer);
	const tool = input.type === "tool" ? input.tool : null;
	// What gestures move: nothing while painting, typing, finding, or
	// adjusting, except the box or shape a tool drags out.
	const movableLayer = rules.selection === "still" ? undefined : selectedLayer;
	const dragsSelection = rules.selection === "drags";

	// Keep the gesture-driven values in step with the selected layer: when the
	// selection changes, and when that layer does (a commit, undo, restyle).
	useLayoutEffect(() => {
		syncLiveTransform(
			live,
			movableLayer?.id ?? null,
			movableLayer && {
				transform: movableLayer.transform,
				box: layerBounds(movableLayer),
				resizeMode: resizeMode(movableLayer),
			},
		);
	}, [live, movableLayer]);

	const toDocument = useCallback(
		(screenX: number, screenY: number) =>
			viewPointToDocument(viewport, { x: screenX, y: screenY }),
		[viewport],
	);

	// The selected layer's handle under a point reported by the view.
	const handleAt = useCallback(
		(screenX: number, screenY: number) =>
			selectedLayer
				? handleUnder(
						selectedLayer.transform,
						layerBounds(selectedLayer),
						resizeMode(selectedLayer),
						toDocument(screenX, screenY),
						scale,
					)
				: null,
		[selectedLayer, toDocument, scale],
	);

	// Topmost selectable layer under a point reported by the view.
	const layerAt = useCallback(
		(screenX: number, screenY: number) =>
			findLayerAt(targets, toDocument(screenX, screenY))?.id ?? null,
		[targets, toDocument],
	);

	const tapAway = useCallback(
		(point: Point) => {
			onTapAway?.();
			onSelectLayer?.(findLayerAt(targets, point)?.id ?? null);
		},
		[onTapAway, onSelectLayer, targets],
	);
	const lookups = useMemo(
		() => ({ handleAt, layerAt, toDocument, tapAway }),
		[handleAt, layerAt, toDocument, tapAway],
	);

	const handleTap = useCallback(
		(screenX: number, screenY: number) => {
			// A click on a handle that didn't become a drag does nothing, rather
			// than deselecting the layer that owns it.
			if (scale === 0 || lookups.handleAt(screenX, screenY)) return;
			const id = lookups.layerAt(screenX, screenY);
			tapOnNothing(id === null ? { x: screenX, y: screenY } : null);
			if (id !== null && id === selectedLayerId) {
				onTapSelectedLayer?.(lookups.toDocument(screenX, screenY));
			} else {
				onSelectLayer?.(id);
			}
		},
		[
			lookups,
			onSelectLayer,
			onTapSelectedLayer,
			scale,
			selectedLayerId,
			tapOnNothing,
		],
	);

	// Where one finger moves the view too: anywhere while finding, whose taps
	// don't drag, and while zoomed in, anywhere off the selected layer and
	// its handles, so another layer is tapped before it's dragged. At the
	// fit, where the view can't move, a drag picks up the layer under it, or
	// moves the selection. Painting, typing, and adjusting keep one finger
	// for themselves. Both the view's gesture and the layers' ask it, once,
	// where the finger lands.
	const oneFingerMode = rules.oneFinger;
	const dragAlone = useMemo(() => {
		if (oneFingerMode === null) return null;
		if (oneFingerMode === "anywhere") {
			return () => {
				"worklet";
				return true;
			};
		}
		return (x: number, y: number) => {
			"worklet";
			const id = live.activeId.value;
			if (id === null) return true;
			const point = viewPointToDocument(viewport, { x, y });
			return (
				liveHandleAt(live, viewport, point) === null &&
				!hitsLayer(sharedTargets.value, id, point)
			);
		};
	}, [oneFingerMode, live, sharedTargets, viewport]);

	// Where a tool's drag moves the selection rather than drawing: on its
	// handles, or on the selection where it's the topmost layer.
	const selectionDrag = useMemo(() => {
		if (!dragsSelection) return null;
		const onSelection = (x: number, y: number) => {
			"worklet";
			const id = live.activeId.value;
			if (id === null) return false;
			const point = viewPointToDocument(viewport, { x, y });
			return (
				liveHandleAt(live, viewport, point) !== null ||
				findLayerAt(sharedTargets.value, point)?.id === id
			);
		};
		const offSelection = (x: number, y: number) => {
			"worklet";
			return !onSelection(x, y);
		};
		return { onSelection, offSelection };
	}, [dragsSelection, live, sharedTargets, viewport]);

	const { cursor, setCursor, handleHover, handleHoverEnd } = useCanvasCursor({
		scale,
		lookups,
		selectedLayer,
		selectedLayerId,
		dragsSelection,
		targets,
		zoom,
	});

	const handleCommit = useCallback(
		(id: string, transform: Transform) => onCommitTransform?.(id, transform),
		[onCommitTransform],
	);
	const handleResize = useCallback(
		(id: string, transform: Transform, box: Box) =>
			onResizeBox?.(id, transform, box.halfWidth * 2, box.halfHeight * 2),
		[onResizeBox],
	);

	const gesture = useLayerTransformGesture({
		live,
		aspectLocked,
		layers: sharedTargets,
		viewport,
		documentSize,
		onTap: handleTap,
		onSelect: onSelectLayer,
		onCommit: handleCommit,
		onResize: handleResize,
		onHover: handleHover,
		onHoverEnd: handleHoverEnd,
		standsAside: selectionDrag?.offSelection ?? dragAlone,
		dragOnly: dragsSelection,
	});
	// Two fingers transform the selected layer while it can, and a tool
	// leaves them to the view.
	const viewGesture = useViewGesture({
		shown,
		frame,
		live,
		twoFingers: rules.selection !== "transforms",
		dragAlone,
		onCommit: commitViewport,
	});
	const nudgeSelection = useCallback(
		(dx: number, dy: number) => {
			if (!selectedLayer || scale === 0) return;
			onNudgeLayer?.(selectedLayer.id, dx / scale, dy / scale);
		},
		[selectedLayer, scale, onNudgeLayer],
	);

	const textGesture = useTextEditGesture({
		edit: textEdit,
		viewport,
		onSelect: onTextSelect,
		onDone: onTextEditDone,
		onCursor: setCursor,
	});

	const { paintGesture, liveStroke } = useToolStroke({
		tool,
		viewport,
		scale,
		documentSize,
		document,
		targets,
		selectedLayer,
		lookups,
		standsAside: selectionDrag?.onSelection,
		onToolStroke,
		onSelectLayer,
		onToolInteractionEnd,
	});
	const cuttingOutId = cutImageId(tool);
	// Empty, text being edited is outlined around its placeholder.
	const textEditLayer = textEdit?.layer ?? null;
	const editedLayer = useMemo(
		() => textEditLayer && withPlaceholder(textEditLayer),
		[textEditLayer],
	);
	const outlinedLayer = outlinedLayerFor(input, {
		layers: document.layers,
		selectedLayer,
		editedLayer,
		adjustedId: adjusting?.layerId,
	});
	const handleIdleTap = useCallback(
		(screenX: number, screenY: number) => {
			if (scale === 0) return;
			lookups.tapAway(lookups.toDocument(screenX, screenY));
		},
		[lookups, scale],
	);
	const idleGesture = useCanvasTap(handleIdleTap);
	// While adjusting, a sideways drag turns the dial, and a tap still puts
	// the tool down.
	const adjustGesture = useDialDragGesture(
		input.type === "dial" ? input.drag : null,
		idleGesture,
	);
	const detectionGesture = useFindTap({
		find: input.type === "regions" ? input : null,
		scale,
		lookups,
		targets,
		document,
		documentSize,
		tapOnNothing,
	});

	const modeGesture = {
		select: gesture,
		tool: paintGesture,
		editText: textGesture,
		regions: detectionGesture,
		dial: adjustGesture,
	}[input.type];
	// The view's gestures join at the top, one by one: a `Simultaneous` nested
	// in another drops the outer one's relations, so the mode's gestures and
	// the view's would race, the first to start cancelling the other. A tool
	// that drags the selection shares one finger with it the same way, each
	// standing aside where the other takes the drag (see `selectionDrag`).
	const canvasGesture = useMemo(
		() =>
			Gesture.Simultaneous(
				modeGesture,
				...(dragsSelection ? [gesture] : []),
				...viewGesture.toGestureArray(),
			),
		[modeGesture, dragsSelection, gesture, viewGesture],
	);

	useImperativeHandle(
		ref,
		() => ({ nudgeSelection, zoom: zoomView, zoomToArea, visibleArea }),
		[nudgeSelection, zoomView, zoomToArea, visibleArea],
	);

	return (
		<View style={styles.container}>
			<GestureDetector gesture={canvasGesture}>
				<View
					ref={containerRef}
					style={[
						styles.container,
						cursorStyle(rules.cursor === "hover" ? cursor : rules.cursor),
					]}
					onLayout={handleLayout}
				>
					{/* sRGB, like export's offscreen surface: filters and adjustments
				    work in the canvas's color space, so a P3 one would look stronger. */}
					<Canvas style={styles.canvas} colorSpace="srgb">
						{scale > 0 && (
							<Group transform={shownTransform}>
								<EditorScene
									document={document}
									selectedLayerId={movableLayer ? selectedLayerId : null}
									textEdit={textEdit}
									viewScale={shown.scale}
									settledScale={scale}
									live={live}
									stroke={liveStroke}
									outlinedLayer={outlinedLayer}
									adjusting={adjusting}
									cuttingOutId={cuttingOutId}
									detections={
										input.type === "regions" ? input.regions : NO_DETECTIONS
									}
									onImageError={handleImageError}
								/>
							</Group>
						)}
					</Canvas>
					{/* At the bottom, clear of new text at the center and the editor's
					    save banner at the top. Touches pass through to the canvas. */}
					{imageFailed && (
						<View
							style={[styles.failure, { bottom: bottomInset + PHOTO_INSET }]}
						>
							<Surface
								style={styles.failurePill}
								contentStyle={styles.failurePillContent}
							>
								<Text style={styles.failureText}>
									A photo couldn't be loaded.
								</Text>
							</Surface>
						</View>
					)}
				</View>
			</GestureDetector>
			{/* Outside the gesture's view, so a press on the bar is the bar's. */}
			{selectionBar &&
				rules.selection === "transforms" &&
				movableLayer &&
				scale > 0 && (
					<SelectionBarFrame
						key={movableLayer.id}
						live={live}
						shown={shown}
						width={size.width - rightInset}
						height={size.height - bottomInset}
					>
						{selectionBar}
					</SelectionBarFrame>
				)}
			{zoom && (
				<View
					style={[
						styles.fit,
						{ left: leftInset + space.sm, bottom: bottomInset + space.sm },
					]}
				>
					<FitButton onPress={() => zoomView("fit")} />
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
	failure: {
		position: "absolute",
		left: PHOTO_INSET,
		right: PHOTO_INSET,
		alignItems: "center",
		pointerEvents: "none",
	},
	fit: {
		position: "absolute",
	},
	failurePill: {
		borderRadius: 18,
	},
	failurePillContent: {
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	failureText: {
		...typography.label,
		color: colors.textPrimary,
	},
});
