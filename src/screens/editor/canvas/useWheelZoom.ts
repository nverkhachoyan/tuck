import {
	type RefObject,
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
} from "react";
import { Platform, type View } from "react-native";
import {
	readShownViewport,
	type ShownViewport,
	showViewport,
} from "./shownViewport";
import {
	type DocumentViewport,
	panViewport,
	type ViewFrame,
	zoomViewportAbout,
} from "./viewport";

// Held for a pinch with Ctrl + mouse wheel, and repeated while held on
// Windows, so they don't commit one.
const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt"]);
// A mouse wheel's line, where the browser counts in lines, in pixels.
const LINE_PX = 16;
// How much zooming each pixel of a pinch scrolls, and the most one event
// counts, so a mouse wheel's notch zooms a step rather than a leap.
const ZOOM_PER_PX = 0.01;
const MAX_ZOOM_PX = 25;
const COMMIT_DELAY_MS = 150;

/**
 * Zooms and pans the view with the wheel on web. A trackpad pinch, which
 * browsers report as wheel events with `ctrlKey` set (as they do Ctrl +
 * mouse wheel), or the wheel with ⌘, zooms about the pointer; scrolling,
 * with two fingers on a trackpad, pans.
 *
 * `shown` follows each event. The wheel has no end event, so the result
 * commits once it goes quiet, or sooner at the next press or key anywhere,
 * before that input's own handlers run, so they see the view it left.
 * The returned function commits it at once.
 */
export function useWheelZoom({
	target,
	shown,
	frame,
	onCommit,
}: {
	target: RefObject<View | null>;
	shown: ShownViewport;
	frame: ViewFrame;
	onCommit: (viewport: DocumentViewport) => void;
}) {
	const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const pending = useRef<DocumentViewport | null>(null);
	// The latest, so a new one (the frame changed) doesn't resubscribe and
	// drop a commit that's waiting.
	const commit = useRef(onCommit);
	useLayoutEffect(() => {
		commit.current = onCommit;
	});

	const flushPendingCommit = useCallback(() => {
		clearTimeout(commitTimer.current);
		commitTimer.current = undefined;
		const viewport = pending.current;
		pending.current = null;
		if (viewport) commit.current(viewport);
	}, []);

	const handleWheel = useEffectEvent((event: WheelEvent, element: Element) => {
		// Otherwise the browser zooms or scrolls the whole page.
		event.preventDefault();
		const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : 1;
		const current = readShownViewport(shown);
		let next: DocumentViewport;
		if (event.ctrlKey || event.metaKey) {
			const bounds = element.getBoundingClientRect();
			const delta = Math.max(
				-MAX_ZOOM_PX,
				Math.min(MAX_ZOOM_PX, event.deltaY * unit),
			);
			next = zoomViewportAbout(frame, current, Math.exp(-delta * ZOOM_PER_PX), {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			});
		} else {
			next = panViewport(
				frame,
				current,
				-event.deltaX * unit,
				-event.deltaY * unit,
			);
		}
		showViewport(shown, next);
		pending.current = next;
		clearTimeout(commitTimer.current);
		commitTimer.current = setTimeout(flushPendingCommit, COMMIT_DELAY_MS);
	});

	useEffect(() => {
		// On web, a View's ref is its DOM element.
		const element = target.current as unknown as HTMLElement | null;
		if (Platform.OS !== "web" || !element) return;

		const wheel = (event: WheelEvent) => handleWheel(event, element);
		const keyDown = (event: KeyboardEvent) => {
			if (!MODIFIER_KEYS.has(event.key)) flushPendingCommit();
		};

		element.addEventListener("wheel", wheel, { passive: false });
		window.addEventListener("pointerdown", flushPendingCommit, true);
		window.addEventListener("keydown", keyDown, true);
		return () => {
			element.removeEventListener("wheel", wheel);
			window.removeEventListener("pointerdown", flushPendingCommit, true);
			window.removeEventListener("keydown", keyDown, true);
			clearTimeout(commitTimer.current);
			commitTimer.current = undefined;
			pending.current = null;
		};
	}, [target, flushPendingCommit]);

	return flushPendingCommit;
}
