import {
	type RefObject,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ViewInstance } from "react-native";
import type { Point, Rect, Size } from "../document/geometry";
import { createDoubleTap } from "./doubleTap";
import { useShownViewport } from "./shownViewport";
import { useWheelZoom } from "./useWheelZoom";
import {
	areaMiddle,
	type DocumentViewport,
	type ViewFrame,
	type ViewZoom,
	viewportForZoom,
	visibleDocumentArea,
	zoomForArea,
	zoomForViewport,
	zoomViewportAbout,
} from "./viewport";

// How much each zoom in or out by key scales the view.
const ZOOM_STEP = 2;
// A double tap where there's nothing to select zooms in by this much.
const DOUBLE_TAP_ZOOM = 3;

/**
 * The canvas's zoom into the fit (see `ViewZoom`), and the viewport it
 * gives `frame`. A trackpad pinch or the wheel on web zooms `target` (see
 * `useWheelZoom`), `commitViewport` keeps where a gesture left the view,
 * `zoomView` zooms by key, `zoomToArea` to a part of the document, and
 * `tapOnNothing` zooms on a double tap. A crop,
 * which changes the document's size, starts afresh at the fit.
 */
export function useCanvasZoom(
	frame: ViewFrame,
	target: RefObject<ViewInstance | null>,
) {
	const { documentSize } = frame;
	// Kept with the size it was zoomed at, so a crop drops it.
	const [zoomed, setZoomed] = useState<{
		zoom: ViewZoom;
		documentSize: Size;
	} | null>(null);
	const zoom = zoomed?.documentSize === documentSize ? zoomed.zoom : null;
	const viewport = useMemo(() => viewportForZoom(frame, zoom), [frame, zoom]);
	// What the canvas draws eases to a new viewport, as when a tray opens or
	// the keyboard rises, rather than jumping. Gestures use the new one at
	// once.
	const shown = useShownViewport(viewport);
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
		target,
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
	const [emptyTaps] = useState(createDoubleTap);
	// A tap on nothing to select: a second one soon after the first, and near
	// it, zooms in there, or back to the fit. Any other tap calls it with
	// null, so it doesn't count toward one.
	const tapOnNothing = useCallback(
		(point: Point | null) => {
			if (!point) emptyTaps.reset();
			else if (emptyTaps.tap(point)) {
				zoomTo(zoom ? null : DOUBLE_TAP_ZOOM, point);
			}
		},
		[emptyTaps, zoom, zoomTo],
	);
	// Zooms about the middle of the view, or back to the fit.
	const zoomView = useCallback(
		(to: "in" | "out" | "fit") => {
			const factor =
				to === "fit" ? null : to === "in" ? ZOOM_STEP : 1 / ZOOM_STEP;
			zoomTo(factor, areaMiddle(frame.area));
		},
		[zoomTo, frame],
	);
	// Shows a document rectangle, with some of the document around it,
	// easing there.
	const zoomToArea = useCallback(
		(rect: Rect) => {
			flushWheel();
			setZoom(zoomForArea(frame, rect));
		},
		[flushWheel, frame, setZoom],
	);
	// The part of the document in view, in document space, even mid-zoom.
	const visibleArea = useCallback(() => {
		flushWheel();
		return visibleDocumentArea(frame, latestViewport.current);
	}, [flushWheel, frame]);

	return {
		zoom,
		viewport,
		shown,
		commitViewport,
		tapOnNothing,
		zoomView,
		zoomToArea,
		visibleArea,
	};
}
