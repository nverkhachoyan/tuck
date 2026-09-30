import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Canvas, Group } from "@shopify/react-native-skia";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type LayoutChangeEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { MappedDetectionRect } from "@/detection/mapDetectionRects";
import { layerBounds } from "@/layers/layerBounds";
import { type TextSelection, wordRange } from "@/layers/textEditing";
import { textIndexAt } from "@/layers/textLayerLayout";
import {
	type EditorDocument,
	isLineShape,
	type Layer,
	type ShapePlacement,
} from "@/model/document";
import {
	type Box,
	hitTestBox,
	type Point,
	type Rect,
	rectFromCorners,
	type Size,
	type Transform,
	toLayerSpace,
} from "@/model/geometry";
import { colors, radii, space, typography, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";
import { Surface } from "@/ui/Surface";
import { useTooltip } from "@/ui/Tooltip";
import type { TextEditState } from "../editorMode";
import {
	type CanvasCursor,
	cursorForHandle,
	cursorStyle,
} from "../handles/canvasCursor";
import { handleMetrics, handleUnder } from "../handles/handleMetrics";
import {
	areaMiddle,
	type DocumentViewport,
	type ViewFrame,
	type ViewZoom,
	viewPointToDocument,
	viewportForZoom,
	visibleDocumentArea,
	zoomForViewport,
	zoomViewportAbout,
} from "../viewport";
import {
	type CanvasTool,
	type DetectionOverlayRegion,
	EditorScene,
	type LiveAdjustment,
	type LiveStroke,
} from "./EditorScene";
import { findLayerAt, hitsLayer, type LayerTarget } from "./hitTest";
import { HIT_PADDING_PX, layerTargets, resizeMode } from "./layerTargets";
import {
	type LiveTransform,
	readLiveBox,
	readLiveTransform,
	syncLiveTransform,
	useLiveTransform,
} from "./liveTransform";
import {
	placeSelectionBar,
	selectionScreenBounds,
} from "./selectionBarPlacement";
import { shapeFromDrag } from "./shapeDrag";
import {
	readShownViewport,
	type ShownViewport,
	useShownViewport,
} from "./shownViewport";
import { useLayerTransformGesture } from "./useLayerTransformGesture";
import { usePaintGesture } from "./usePaintGesture";
import { type TextPressPhase, useTextEditGesture } from "./useTextEditGesture";
import { useViewGesture } from "./useViewGesture";
import { useWheelZoom } from "./useWheelZoom";

// How much each zoom in or out by key scales the view.
const ZOOM_STEP = 2;
const DOUBLE_TAP_ZOOM = 3;
// Inside the canvas rather than around it, so layers past the photo's edge
// and their handles still have room to draw.
const PHOTO_INSET = 16;
// A box or a line dragged no further than this either way, in screen
// pixels, was a tap; a box this thin in only one way is dropped.
const TAP_SLOP_PX = 6;
// A second tap this soon after the first, and this near it in screen
// pixels, selects a word of edited text, or zooms where there's nothing to
// select, by `DOUBLE_TAP_ZOOM`.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 12;
// The selection bar's distance from the selection, above it past the rotate
// knob or below it past the handles, and from the view's edges.
const SELECTION_BAR_GAPS = {
	above: handleMetrics.knobOffset + handleMetrics.size / 2 + 10,
	below: handleMetrics.size / 2 + 12,
	margin: 8,
};

type EditorCanvasProps = {
	ref?: Ref<EditorCanvasHandle>;
	document: EditorDocument;
	selectedLayer?: Layer;
	// While set, this text is edited in place (see `TextEditState`). Presses
	// on it place the caret or select, and a tap off it finishes.
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
	// While set, dragging paints or drags out boxes with this tool instead of
	// selecting and moving layers.
	tool?: CanvasTool | null;
	// A finished stroke's points, in document space.
	onPaintStroke?: (points: number[]) => void;
	// A finished redaction box, in document space.
	onDrawBox?: (rect: Rect) => void;
	// A finished shape, in document space.
	onDrawShape?: (placement: ShapePlacement) => void;
	// Where a tap, or a drag's end, picks a color, in document space.
	onPickPoint?: (point: Point) => void;
	// A canvas-tool gesture has finished. A tool can use this to put away its
	// options after the same gesture has drawn, rather than blocking the draw.
	onToolInteractionEnd?: () => void;
	// A tap away from what the tool works on, while painting, finding, or
	// adjusting. The editor puts the tool down, and the tap then selects what's
	// under it, as it would without a tool.
	onTapAway?: () => void;
	// While set, this image's adjustments are being changed: it's outlined
	// when there are other images, and the canvas holds still.
	adjusting?: LiveAdjustment | null;
	// Temporary detector proposals, found in the image `imageId`. While
	// present, taps toggle them instead of selecting or drawing on the
	// document.
	detection?: {
		regions: readonly DetectionOverlayRegion[];
		imageId: string;
		onToggle: (sourceIndex: number) => void;
	} | null;
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
 * the selected layer or its handles, and so does it anywhere while finding
 * or adjusting. While zoomed, a Fit button returns to the fit. A crop, which
 * changes the document's size, starts afresh at the fit.
 *
 * All touch handling (tap-to-select, drag/pinch/rotate, the selection's
 * scale, resize, and rotate handles) is a single gesture on the canvas; selection is
 * resolved by hit-testing in document space, against `layerTargets`, which
 * the UI thread shares so a drag can pick its layer there. With a mouse, the
 * cursor shows what a press at the pointer would do.
 *
 * With a `tool`, a single gesture paints instead, into the selected layer
 * if the tool can add to it, or drags out a shape or a redaction's box. The
 * selection then holds still, and only a redaction's or a shape's is
 * outlined, to show what the tool's style changes. Dragging out a box or a
 * shape, a tap picks the one to change, or none. Picking a color, where the
 * finger lifts is the point. While `adjusting`, presses do nothing.
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
	textEdit = null,
	onTextSelect,
	onTextEditDone,
	onSelectLayer,
	onTapSelectedLayer,
	onCommitTransform,
	onResizeBox,
	onNudgeLayer,
	tool = null,
	onPaintStroke,
	onDrawBox,
	onDrawShape,
	onPickPoint,
	onToolInteractionEnd,
	onTapAway,
	adjusting = null,
	detection = null,
	bottomInset = 0,
	leftInset = 0,
	rightInset = 0,
	selectionBar,
}: EditorCanvasProps) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [cursor, setCursor] = useState<CanvasCursor>("default");
	const [imageFailed, setImageFailed] = useState(false);
	const containerRef = useRef<View>(null);
	const live = useLiveTransform();
	const aspectLocked = useSharedValue(false);

	// React Native Gesture Handler does not expose keyboard modifiers on a Pan.
	// Keep Shift in a shared value so the UI-thread resize gesture can read it.
	useEffect(() => {
		// Native has a `window`, but no events on it.
		if (Platform.OS !== "web") return;
		const setLock = (event: KeyboardEvent) => {
			aspectLocked.value = event.shiftKey;
		};
		window.addEventListener("keydown", setLock);
		window.addEventListener("keyup", setLock);
		const clearLock = () => {
			aspectLocked.value = false;
		};
		window.addEventListener("blur", clearLock);
		return () => {
			window.removeEventListener("keydown", setLock);
			window.removeEventListener("keyup", setLock);
			window.removeEventListener("blur", clearLock);
		};
	}, [aspectLocked]);

	// On web, a press on the canvas would take the focus, and with it the
	// keyboard, from the input typing into the edited text. The press places
	// its caret instead.
	const editingText = textEdit !== null;
	useEffect(() => {
		if (Platform.OS !== "web" || !editingText) return;
		const node = containerRef.current as unknown as HTMLElement | null;
		const keepFocus = (event: MouseEvent) => event.preventDefault();
		node?.addEventListener("mousedown", keepFocus);
		return () => node?.removeEventListener("mousedown", keepFocus);
	}, [editingText]);

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
	// Kept with the size it was zoomed at, so a crop drops it.
	const [zoomed, setZoomed] = useState<{
		zoom: ViewZoom;
		documentSize: Size;
	} | null>(null);
	const zoom = zoomed?.documentSize === documentSize ? zoomed.zoom : null;
	const viewport = useMemo(() => viewportForZoom(frame, zoom), [frame, zoom]);
	const { scale } = viewport;
	// What the canvas draws eases to a new viewport, as when a tray opens or
	// the keyboard rises, rather than jumping. Gestures use the new one at
	// once.
	const shown = useShownViewport(viewport);
	const shownTransform = useDerivedValue(() => [
		{ translateX: shown.offsetX.value },
		{ translateY: shown.offsetY.value },
		{ scale: shown.scale.value },
	]);
	// Where the view is headed, as of its last change: a render, or a zoom
	// that's still to render.
	const latestViewport = useRef(viewport);
	useLayoutEffect(() => {
		latestViewport.current = viewport;
	}, [viewport]);
	const setZoom = useCallback(
		(zoom: ViewZoom | null) => {
			latestViewport.current = viewportForZoom(frame, zoom);
			setZoomed(zoom && { zoom, documentSize });
		},
		[frame, documentSize],
	);
	const commitViewport = useCallback(
		(next: DocumentViewport) => setZoom(zoomForViewport(frame, next)),
		[frame, setZoom],
	);
	const flushWheel = useWheelZoom({
		target: containerRef,
		shown,
		frame,
		onCommit: commitViewport,
	});
	// Scales the view by `factor` about `point`, or returns it to the fit
	// without one, easing there.
	const zoomTo = useCallback(
		(factor: number | null, point: Point) => {
			flushWheel();
			setZoom(
				factor === null
					? null
					: zoomForViewport(
							frame,
							zoomViewportAbout(frame, latestViewport.current, factor, point),
						),
			);
		},
		[flushWheel, frame, setZoom],
	);
	const lastEmptyTap = useRef({ time: 0, x: 0, y: 0 });
	// A tap on nothing to select: a second one soon after the first, and near
	// it, zooms in there, or back to the fit. Any other tap calls it with
	// null, so it doesn't count toward one.
	const tapOnNothing = useCallback(
		(point: Point | null) => {
			const last = lastEmptyTap.current;
			const double =
				point !== null &&
				Date.now() - last.time < DOUBLE_TAP_MS &&
				Math.hypot(point.x - last.x, point.y - last.y) < DOUBLE_TAP_SLOP_PX;
			lastEmptyTap.current =
				point && !double
					? { time: Date.now(), ...point }
					: { time: 0, x: 0, y: 0 };
			if (double) zoomTo(zoom ? null : DOUBLE_TAP_ZOOM, point);
		},
		[zoom, zoomTo],
	);

	const targets = useMemo(
		() => (scale > 0 ? layerTargets(document, scale) : []),
		[document, scale],
	);
	const sharedTargets = useSharedValue<readonly LayerTarget[]>([]);
	useLayoutEffect(() => {
		sharedTargets.value = targets;
	}, [sharedTargets, targets]);

	const selectedLayerId = selectedLayer?.id ?? null;
	// What gestures move: nothing while painting, typing, or adjusting.
	const holdingStill =
		tool !== null ||
		textEdit !== null ||
		adjusting !== null ||
		detection !== null;
	const movableLayer = holdingStill ? undefined : selectedLayer;

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

	// The selected layer's handle under a point reported by the view.
	const handleAt = useCallback(
		(screenX: number, screenY: number) =>
			selectedLayer
				? handleUnder(
						selectedLayer.transform,
						layerBounds(selectedLayer),
						resizeMode(selectedLayer),
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
				targets,
				viewPointToDocument(viewport, { x: screenX, y: screenY }),
			)?.id ?? null,
		[targets, viewport],
	);

	const tapAway = useCallback(
		(point: Point) => {
			onTapAway?.();
			onSelectLayer?.(findLayerAt(targets, point)?.id ?? null);
		},
		[onTapAway, onSelectLayer, targets],
	);

	const handleTap = useCallback(
		(screenX: number, screenY: number) => {
			// A click on a handle that didn't become a drag does nothing, rather
			// than deselecting the layer that owns it.
			if (scale === 0 || handleAt(screenX, screenY)) return;
			const id = layerAt(screenX, screenY);
			tapOnNothing(id === null ? { x: screenX, y: screenY } : null);
			if (id !== null && id === selectedLayerId) {
				onTapSelectedLayer?.(
					viewPointToDocument(viewport, { x: screenX, y: screenY }),
				);
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
			tapOnNothing,
			viewport,
		],
	);

	// Where one finger moves the view too: anywhere while finding or
	// adjusting, whose taps don't drag, and while zoomed in, anywhere off the
	// selected layer and its handles, so another layer is tapped before it's
	// dragged. At the fit, where the view can't move, a drag picks up the
	// layer under it, or moves the selection. Painting and typing keep one
	// finger for themselves. Both the view's gesture and the layers' ask it,
	// once, where the finger lands.
	const oneFingerMode =
		tool !== null || textEdit !== null
			? null
			: detection !== null || adjusting !== null
				? "anywhere"
				: zoom
					? "offSelection"
					: null;
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
				handleUnder(
					readLiveTransform(live),
					readLiveBox(live),
					live.resizeMode.value,
					point,
					viewport.scale,
				) === null && !hitsLayer(sharedTargets.value, id, point)
			);
		};
	}, [oneFingerMode, live, sharedTargets, viewport]);

	// What a press at the pointer would do: grab a handle, move a layer, move
	// the view, or nothing. Renders only when that changes, not on every
	// pointer move.
	const handleHover = useCallback(
		(screenX: number, screenY: number) => {
			if (scale === 0) return;
			const handle = handleAt(screenX, screenY);
			if (handle && selectedLayer) {
				setCursor(cursorForHandle(handle, selectedLayer.transform.rotation));
				return;
			}
			if (zoom) {
				const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
				const onSelection =
					selectedLayerId !== null &&
					hitsLayer(targets, selectedLayerId, point);
				setCursor(onSelection ? "move" : "grab");
				return;
			}
			setCursor(layerAt(screenX, screenY) === null ? "default" : "move");
		},
		[
			handleAt,
			layerAt,
			scale,
			selectedLayer,
			selectedLayerId,
			targets,
			viewport,
			zoom,
		],
	);
	const handleHoverEnd = useCallback(() => setCursor("default"), []);

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
		dragsView: dragAlone,
	});
	// Two fingers transform the selected layer while it can move.
	const viewGesture = useViewGesture({
		shown,
		frame,
		live,
		twoFingers: movableLayer === undefined,
		dragAlone,
		onCommit: commitViewport,
	});
	const zoomView = useCallback(
		(to: "in" | "out" | "fit") => {
			const factor =
				to === "fit" ? null : to === "in" ? ZOOM_STEP : 1 / ZOOM_STEP;
			zoomTo(factor, areaMiddle(frame.area));
		},
		[zoomTo, frame],
	);
	const visibleArea = useCallback(() => {
		flushWheel();
		return visibleDocumentArea(frame, latestViewport.current);
	}, [flushWheel, frame]);
	const nudgeSelection = useCallback(
		(dx: number, dy: number) => {
			if (!selectedLayer || scale === 0) return;
			onNudgeLayer?.(selectedLayer.id, dx / scale, dy / scale);
		},
		[selectedLayer, scale, onNudgeLayer],
	);

	// Where the edited text is under a point reported by the view: the index
	// of its text there, or null off it, or outside its box.
	const textIndexUnder = useCallback(
		(screenX: number, screenY: number, clampToText = false) => {
			if (!textEdit || scale === 0) return null;
			const { layer } = textEdit;
			const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
			const padding = HIT_PADDING_PX / (scale * layer.transform.scaleX);
			if (
				!clampToText &&
				!hitTestBox(layer.transform, layerBounds(layer, padding), point)
			) {
				return null;
			}
			return textIndexAt(layer, toLayerSpace(layer.transform, point));
		},
		[textEdit, scale, viewport],
	);
	// The press under way on edited text: where it landed, and the index a
	// drag selects from, or null when it's off the text or selected a word.
	const textPress = useRef<{
		x: number;
		y: number;
		anchor: number | null;
		onText: boolean;
	} | null>(null);
	const lastTextTap = useRef({ time: 0, x: 0, y: 0 });
	const handleTextPress = useCallback(
		(phase: TextPressPhase, screenX: number, screenY: number) => {
			if (!textEdit) return;
			// A second finger landed, to zoom.
			if (phase === "cancel") {
				textPress.current = null;
				return;
			}
			if (phase === "begin") {
				const index = textIndexUnder(screenX, screenY);
				const last = lastTextTap.current;
				const double =
					index !== null &&
					Date.now() - last.time < DOUBLE_TAP_MS &&
					Math.hypot(screenX - last.x, screenY - last.y) < DOUBLE_TAP_SLOP_PX;
				textPress.current = {
					x: screenX,
					y: screenY,
					anchor: double ? null : index,
					onText: index !== null,
				};
				if (index === null) return;
				lastTextTap.current = double
					? { time: 0, x: 0, y: 0 }
					: { time: Date.now(), x: screenX, y: screenY };
				onTextSelect?.(
					double
						? wordRange(textEdit.layer.text, index)
						: { start: index, end: index },
				);
				return;
			}
			const press = textPress.current;
			if (!press) return;
			if (phase === "end") textPress.current = null;
			if (press.anchor !== null) {
				const index = textIndexUnder(screenX, screenY, true) ?? press.anchor;
				onTextSelect?.({
					start: Math.min(press.anchor, index),
					end: Math.max(press.anchor, index),
				});
				return;
			}
			// A tap off the text finishes; a drag there does nothing.
			const travel = Math.hypot(screenX - press.x, screenY - press.y);
			if (phase === "end" && !press.onText && travel < TAP_SLOP_PX) {
				onTextEditDone?.();
			}
		},
		[textEdit, textIndexUnder, onTextSelect, onTextEditDone],
	);
	const handleTextHover = useCallback(
		(screenX: number, screenY: number) =>
			setCursor(textIndexUnder(screenX, screenY) === null ? "default" : "text"),
		[textIndexUnder],
	);
	// The handlers change with every keystroke, and a new gesture could cut
	// off a drag that's selecting, so the gesture keeps stable ones that call
	// the latest.
	const textHandlers = useRef({
		press: handleTextPress,
		hover: handleTextHover,
	});
	useLayoutEffect(() => {
		textHandlers.current = { press: handleTextPress, hover: handleTextHover };
	});
	const onTextPress = useCallback(
		(phase: TextPressPhase, x: number, y: number) =>
			textHandlers.current.press(phase, x, y),
		[],
	);
	const onTextHover = useCallback(
		(x: number, y: number) => textHandlers.current.hover(x, y),
		[],
	);
	const textGesture = useTextEditGesture({
		onPress: onTextPress,
		onHover: onTextHover,
		onHoverEnd: handleHoverEnd,
	});

	const strokePoints = useSharedValue<number[]>([]);
	const strokeId = useSharedValue(0);
	// The last stroke handed to the document. It changes in the same render as
	// the document, or the one after, so the scene stops drawing the stroke
	// live only once it draws it from the document.
	const [landedStrokeId, setLandedStrokeId] = useState(0);
	const handleStroke = useCallback(
		(points: number[], id: number) => {
			if (!tool || points.length < 2) return;
			setLandedStrokeId(id);
			onToolInteractionEnd?.();
			if (tool.type === "pickColor") {
				const end = points.length - 2;
				onPickPoint?.({ x: points[end], y: points[end + 1] });
				return;
			}
			const start = { x: points[0], y: points[1] };
			if (
				!insideDocument(documentSize, start) &&
				staysWithin(points, TAP_SLOP_PX / scale)
			) {
				tapAway(start);
				return;
			}
			if (tool.type !== "redactBox" && tool.type !== "drawShape") {
				onPaintStroke?.(points);
				return;
			}
			const end = {
				x: points[points.length - 2],
				y: points[points.length - 1],
			};
			const line = tool.type === "drawShape" && isLineShape(tool.shape);
			const box = rectFromCorners(start, end);
			// A box too thin to show is dropped, rather than taken for a tap.
			if (Math.max(box.width, box.height) * scale >= TAP_SLOP_PX) {
				if (!line && Math.min(box.width, box.height) * scale < TAP_SLOP_PX) {
					return;
				}
				if (tool.type === "redactBox") onDrawBox?.(box);
				else onDrawShape?.(shapeFromDrag(tool.shape, start, end));
				return;
			}
			const hit = findLayerAt(targets, start);
			const tapped = document.layers.find((layer) => layer.id === hit?.id);
			const kind = tool.type === "redactBox" ? "redaction" : "shape";
			onSelectLayer?.(tapped?.type === kind ? tapped.id : null);
		},
		[
			tool,
			onPaintStroke,
			onDrawBox,
			onDrawShape,
			onPickPoint,
			onToolInteractionEnd,
			onSelectLayer,
			tapAway,
			documentSize,
			scale,
			targets,
			document,
		],
	);
	const paintGesture = usePaintGesture({
		viewport,
		points: strokePoints,
		strokeId,
		onStroke: handleStroke,
	});
	const liveStroke = useMemo<LiveStroke | null>(
		() =>
			tool && {
				tool,
				points: strokePoints,
				id: strokeId,
				landedId: landedStrokeId,
				targetId:
					selectedLayer && canAddTo(tool, selectedLayer)
						? selectedLayer.id
						: null,
			},
		[tool, strokePoints, strokeId, landedStrokeId, selectedLayer],
	);
	// Outlined only where it could be mistaken for another image.
	const adjustedLayer =
		adjusting &&
		document.layers.filter((layer) => layer.type === "image").length > 1 &&
		document.layers.find((layer) => layer.id === adjusting.layerId);
	const outlinedLayer =
		((tool?.type === "redactBox" || tool?.type === "redactBrush") &&
			selectedLayer?.type === "redaction") ||
		(tool?.type === "drawShape" && selectedLayer?.type === "shape")
			? selectedLayer
			: !tool && textEdit
				? textEdit.layer
				: adjustedLayer || null;
	const handleIdleTap = useCallback(
		(screenX: number, screenY: number) => {
			if (scale === 0) return;
			tapAway(viewPointToDocument(viewport, { x: screenX, y: screenY }));
		},
		[tapAway, scale, viewport],
	);
	// Short of a pinch's travel, so two fingers zooming aren't a tap.
	const idleGesture = useMemo(
		() =>
			Gesture.Tap()
				.maxDistance(TAP_SLOP_PX)
				.onEnd((event, success) => {
					if (success) scheduleOnRN(handleIdleTap, event.x, event.y);
				}),
		[handleIdleTap],
	);
	const handleDetectionTap = useCallback(
		(screenX: number, screenY: number) => {
			if (!detection || scale === 0) return;
			const point = viewPointToDocument(viewport, { x: screenX, y: screenY });
			const padding = 10 / scale;
			let hit: MappedDetectionRect | null = null;
			for (const region of detection.regions) {
				if (
					hitTestBox(
						region.transform,
						{
							halfWidth: region.width / 2 + padding,
							halfHeight: region.height / 2 + padding,
						},
						point,
					) &&
					(!hit || region.width * region.height < hit.width * hit.height)
				) {
					hit = region;
				}
			}
			if (hit) {
				tapOnNothing(null);
				detection.onToggle(hit.sourceIndex);
				return;
			}
			// A miss on the image, as by a face, keeps finding, and a second one
			// zooms (see `tapOnNothing`). Where the image is
			// locked, it has no hit box, and shows only inside the document.
			const under = findLayerAt(targets, point)?.id ?? null;
			const image = document.layers.find(
				(layer) => layer.id === detection.imageId,
			);
			const onImage =
				under === null
					? image !== undefined &&
						insideDocument(documentSize, point) &&
						hitTestBox(image.transform, layerBounds(image), point)
					: under === detection.imageId;
			if (onImage) tapOnNothing({ x: screenX, y: screenY });
			else tapAway(point);
		},
		[
			detection,
			scale,
			viewport,
			targets,
			document,
			documentSize,
			tapAway,
			tapOnNothing,
		],
	);
	const detectionGesture = useMemo(
		() =>
			Gesture.Tap()
				.maxDistance(TAP_SLOP_PX)
				.onEnd((event, success) => {
					if (success) scheduleOnRN(handleDetectionTap, event.x, event.y);
				}),
		[handleDetectionTap],
	);

	const modeGesture = detection
		? detectionGesture
		: tool
			? paintGesture
			: textEdit
				? textGesture
				: adjusting
					? idleGesture
					: gesture;
	// The view's gestures join at the top, one by one: a `Simultaneous` nested
	// in another drops the outer one's relations, so the mode's gestures and
	// the view's would race, the first to start cancelling the other.
	const canvasGesture = useMemo(
		() => Gesture.Simultaneous(modeGesture, ...viewGesture.toGestureArray()),
		[modeGesture, viewGesture],
	);

	useImperativeHandle(
		ref,
		() => ({ nudgeSelection, zoom: zoomView, visibleArea }),
		[nudgeSelection, zoomView, visibleArea],
	);

	return (
		<View style={styles.container}>
			<GestureDetector gesture={canvasGesture}>
				<View
					ref={containerRef}
					style={[
						styles.container,
						cursorStyle(
							detection
								? "pointer"
								: tool
									? "crosshair"
									: adjusting
										? zoom
											? "grab"
											: "default"
										: cursor,
						),
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
									selectedLayerId={holdingStill ? null : selectedLayerId}
									textEdit={textEdit}
									viewScale={shown.scale}
									settledScale={scale}
									live={live}
									stroke={liveStroke}
									outlinedLayer={outlinedLayer}
									adjusting={adjusting}
									detections={detection?.regions ?? []}
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
			{selectionBar && movableLayer && scale > 0 && (
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

/** Returns a zoomed view to the fit. */
function FitButton({ onPress }: { onPress: () => void }) {
	const { anchor, tooltip } = useTooltip("Zoom to fit", "mod+0");
	return (
		<>
			<Surface style={styles.fitPill}>
				<Pressable
					{...anchor}
					hitSlop={8}
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel="Zoom to fit"
					style={(state) => {
						const { pressed, hovered } = interaction(state);
						return [
							styles.fitButton,
							webTransition,
							hovered && styles.fitHovered,
							pressed && styles.fitPressed,
						];
					}}
				>
					<MaterialCommunityIcons
						name="fit-to-screen-outline"
						size={18}
						color={colors.textPrimary}
					/>
					<Text style={styles.fitLabel}>Fit</Text>
				</Pressable>
			</Surface>
			{tooltip}
		</>
	);
}

/**
 * Places `children` by the selection (see `placeSelectionBar`), within
 * `width` and `height`, as the live values move it. It's hidden until it has
 * a size to place, and while a gesture holds the layer.
 */
function SelectionBarFrame({
	live,
	shown,
	width,
	height,
	children,
}: {
	live: LiveTransform;
	shown: ShownViewport;
	width: number;
	height: number;
	children: ReactNode;
}) {
	const barSize = useSharedValue({ width: 0, height: 0 });
	const style = useAnimatedStyle(() => {
		const { x, y } = placeSelectionBar(
			selectionScreenBounds(
				readLiveTransform(live),
				readLiveBox(live),
				readShownViewport(shown),
			),
			barSize.value,
			{ width, height },
			SELECTION_BAR_GAPS,
		);
		const visible =
			barSize.value.width > 0 &&
			live.activeId.value !== null &&
			live.heldId.value === null;
		return {
			transform: [{ translateX: x }, { translateY: y }],
			opacity: withTiming(visible ? 1 : 0, { duration: visible ? 160 : 80 }),
		};
	}, [live, shown, width, height]);
	return (
		// A plain view, since Reanimated drops `box-none` on web.
		<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
			<Animated.View
				style={[styles.selectionBar, style]}
				onLayout={(event) => {
					const { width, height } = event.nativeEvent.layout;
					barSize.value = { width, height };
				}}
			>
				{children}
			</Animated.View>
		</View>
	);
}

function insideDocument(size: { width: number; height: number }, point: Point) {
	return (
		point.x >= 0 &&
		point.y >= 0 &&
		point.x <= size.width &&
		point.y <= size.height
	);
}

/** Whether a stroke's points, flat pairs, all stay within `slop` of its first. */
function staysWithin(points: number[], slop: number): boolean {
	for (let i = 2; i < points.length; i += 2) {
		if (Math.hypot(points[i] - points[0], points[i + 1] - points[1]) > slop) {
			return false;
		}
	}
	return true;
}

/** Whether `tool`'s strokes join `layer`, rather than starting a new one. */
function canAddTo(tool: CanvasTool, layer: Layer): boolean {
	if (layer.locked) return false;
	switch (tool.type) {
		case "draw":
			return layer.type === "drawing";
		case "redactBrush":
			return layer.type === "redaction" && layer.shape === "strokes";
		case "redactBox":
		case "drawShape":
		case "pickColor":
			return false;
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
	selectionBar: {
		position: "absolute",
		top: 0,
		left: 0,
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
	fitPill: {
		borderRadius: radii.medium,
	},
	fitButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xxs + 2,
		paddingVertical: space.xs,
		paddingLeft: space.sm - 2,
		paddingRight: space.sm,
	},
	fitHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	fitPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	fitLabel: {
		...typography.label,
		color: colors.textPrimary,
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
