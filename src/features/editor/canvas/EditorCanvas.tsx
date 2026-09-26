import { Canvas, Group } from "@shopify/react-native-skia";
import {
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
	StyleSheet,
	Text,
	View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { layerBounds } from "@/layers/layerBounds";
import { type TextSelection, wordRange } from "@/layers/textEditing";
import { textIndexAt } from "@/layers/textLayerLayout";
import type { EditorDocument, Layer } from "@/model/document";
import {
	type Box,
	hitTestBox,
	type Point,
	type Rect,
	rectFromCorners,
	type Transform,
	toLayerSpace,
} from "@/model/geometry";
import { colors } from "@/theme";
import { GlassView } from "@/ui/GlassView";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import {
	type CanvasCursor,
	cursorForHandle,
	cursorStyle,
} from "../handles/canvasCursor";
import { handleUnder } from "../handles/handleMetrics";
import { fitDocumentToView, viewPointToDocument } from "../viewport";
import {
	type CanvasTool,
	EditorScene,
	type LiveStroke,
	type TextEditState,
} from "./EditorScene";
import { findLayerAt, type LayerTarget } from "./hitTest";
import { HIT_PADDING_PX, layerTargets, resizeMode } from "./layerTargets";
import { syncLiveTransform, useLiveTransform } from "./liveTransform";
import { useLayerTransformGesture } from "./useLayerTransformGesture";
import { usePaintGesture } from "./usePaintGesture";
import { type TextPressPhase, useTextEditGesture } from "./useTextEditGesture";
import { useTrackpadPinch } from "./useTrackpadPinch";

// Inside the canvas rather than around it, so layers past the photo's edge
// and their handles still have room to draw.
const PHOTO_INSET = 16;
// A box dragged no further than this either way, in screen pixels, was a
// tap; one this thin in only one way hides nothing.
const TAP_SLOP_PX = 6;
// A second tap on text this soon after the first, and this near it in
// screen pixels, selects a word.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 12;
// Between the document and the keyboard, while it's up.
const KEYBOARD_GAP = 8;

type EditorCanvasProps = {
	ref?: Ref<EditorCanvasHandle>;
	document: EditorDocument;
	selectedLayer?: Layer;
	// While set, this text is edited in place (see `TextEditState`). Presses
	// on it place the caret or select, and a tap off it finishes. The
	// document fits above the keyboard.
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
	// Where a tap, or a drag's end, picks a color, in document space.
	onPickPoint?: (point: Point) => void;
	// How much of the view's bottom is covered by panels floating over it.
	// The document fits above them, and what's past its edges shows under.
	bottomInset?: number;
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
 * scale, resize, and rotate handles) is a single gesture on the canvas; selection is
 * resolved by hit-testing in document space, against `layerTargets`, which
 * the UI thread shares so a drag can pick its layer there. With a mouse, the
 * cursor shows what a press at the pointer would do.
 *
 * With a `tool`, a single gesture paints instead, into the selected layer
 * if the tool can add to it, or drags out a redaction's box. The selection
 * then holds still, and only a redaction's is outlined, to show what the
 * redact tool's style changes. In box mode, a tap picks the redaction to
 * change, or none. Picking a color, where the finger lifts is the point.
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
	onPickPoint,
	bottomInset = 0,
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
		if (typeof window === "undefined") return;
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
	const keyboardOverlap = useKeyboardOverlap(containerRef, editingText);
	const fitInset =
		keyboardOverlap > 0
			? Math.max(bottomInset, keyboardOverlap + KEYBOARD_GAP)
			: bottomInset;
	const viewport = useMemo(
		() =>
			fitDocumentToView(
				documentSize,
				{ width: size.width, height: size.height - fitInset },
				PHOTO_INSET,
			),
		[documentSize, size, fitInset],
	);
	const { scale, offsetX, offsetY } = viewport;

	const targets = useMemo(
		() => (scale > 0 ? layerTargets(document, scale) : []),
		[document, scale],
	);
	const sharedTargets = useSharedValue<readonly LayerTarget[]>([]);
	useLayoutEffect(() => {
		sharedTargets.value = targets;
	}, [sharedTargets, targets]);

	const selectedLayerId = selectedLayer?.id ?? null;
	// What gestures move: nothing while painting or typing.
	const movableLayer = tool || textEdit ? undefined : selectedLayer;

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
						resizeMode(selectedLayer) !== "none",
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

	const handleTap = useCallback(
		(screenX: number, screenY: number) => {
			// A click on a handle that didn't become a drag does nothing, rather
			// than deselecting the layer that owns it.
			if (scale === 0 || handleAt(screenX, screenY)) return;
			const id = layerAt(screenX, screenY);
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
			viewport,
		],
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
	});
	const flushPendingTransform = useTrackpadPinch({
		target: containerRef,
		live,
		onCommit: handleCommit,
	});
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
			if (tool.type === "pickColor") {
				const end = points.length - 2;
				onPickPoint?.({ x: points[end], y: points[end + 1] });
				return;
			}
			if (tool.type !== "redactBox") {
				onPaintStroke?.(points);
				return;
			}
			const start = { x: points[0], y: points[1] };
			const box = rectFromCorners(start, {
				x: points[points.length - 2],
				y: points[points.length - 1],
			});
			// A box too thin to hide anything is dropped, rather than taken
			// for a tap.
			if (Math.max(box.width, box.height) * scale >= TAP_SLOP_PX) {
				if (Math.min(box.width, box.height) * scale >= TAP_SLOP_PX) {
					onDrawBox?.(box);
				}
				return;
			}
			const hit = findLayerAt(targets, start);
			const tapped = document.layers.find((layer) => layer.id === hit?.id);
			onSelectLayer?.(tapped?.type === "redaction" ? tapped.id : null);
		},
		[
			tool,
			onPaintStroke,
			onDrawBox,
			onPickPoint,
			onSelectLayer,
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
	const outlinedLayer =
		(tool?.type === "redactBox" || tool?.type === "redactBrush") &&
		selectedLayer?.type === "redaction"
			? selectedLayer
			: !tool && textEdit
				? textEdit.layer
				: null;

	useImperativeHandle(ref, () => ({ flushPendingTransform, nudgeSelection }), [
		flushPendingTransform,
		nudgeSelection,
	]);

	return (
		<GestureDetector
			gesture={tool ? paintGesture : textEdit ? textGesture : gesture}
		>
			<View
				ref={containerRef}
				style={[styles.container, cursorStyle(tool ? "crosshair" : cursor)]}
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
								selectedLayerId={tool || textEdit ? null : selectedLayerId}
								textEdit={textEdit}
								viewScale={scale}
								live={live}
								stroke={liveStroke}
								outlinedLayer={outlinedLayer}
								onImageError={handleImageError}
							/>
						</Group>
					)}
				</Canvas>
				{/* At the bottom, clear of new text at the center and the editor's
					    save banner at the top. Touches pass through to the canvas. */}
				{imageFailed && (
					<View style={[styles.failure, { bottom: bottomInset + PHOTO_INSET }]}>
						<GlassView
							style={styles.failurePill}
							contentStyle={styles.failurePillContent}
						>
							<Text style={styles.failureText}>
								A photo couldn't be loaded.
							</Text>
						</GlassView>
					</View>
				)}
			</View>
		</GestureDetector>
	);
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
	failure: {
		position: "absolute",
		left: PHOTO_INSET,
		right: PHOTO_INSET,
		alignItems: "center",
		pointerEvents: "none",
	},
	failurePill: {
		borderRadius: 18,
	},
	failurePillContent: {
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	failureText: {
		fontSize: 14,
		color: colors.textPrimary,
	},
});
