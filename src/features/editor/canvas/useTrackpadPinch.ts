import { type RefObject, useCallback, useEffect, useRef } from "react";
import { Platform, type View } from "react-native";
import type { Transform } from "@/model/geometry";
import {
	clampScale,
	type LiveTransform,
	readLiveTransform,
} from "./liveTransform";

// Held for a pinch with Ctrl + mouse wheel, and repeated while held on
// Windows, so they don't end one.
const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt"]);

/**
 * Scales the selected layer with a trackpad pinch on web, which browsers
 * report as wheel events with `ctrlKey` set (so does Ctrl + mouse wheel).
 * A pinch has no end event, so the result commits once the wheel goes quiet,
 * or sooner at the next press or key anywhere, before that input's own
 * handlers run. Whatever it does then lands after the pinch, in the
 * document and in undo.
 */
export function useTrackpadPinch({
	target,
	live,
	onCommit,
}: {
	target: RefObject<View | null>;
	live: LiveTransform;
	onCommit: (id: string, transform: Transform) => void;
}) {
	const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const pendingCommit = useRef<{
		id: string;
		transform: Transform;
	} | null>(null);

	const flushPendingCommit = useCallback(() => {
		clearTimeout(commitTimer.current);
		commitTimer.current = undefined;
		const pending = pendingCommit.current;
		pendingCommit.current = null;
		if (pending) onCommit(pending.id, pending.transform);
	}, [onCommit]);

	useEffect(() => {
		// On web, a View's ref is its DOM element.
		const element = target.current as unknown as HTMLElement | null;
		if (Platform.OS !== "web" || !element) return;

		const handleWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			// Otherwise the browser zooms the whole page.
			event.preventDefault();
			const id = live.activeId.value;
			if (id === null) return;
			const priorScaleX = live.scaleX.value;
			const priorScaleY = live.scaleY.value;
			const scale = clampScale(priorScaleX * Math.exp(-event.deltaY * 0.01));
			live.scaleX.value = scale;
			live.scaleY.value = (priorScaleY / priorScaleX) * scale;
			// Captured now: by the time the timer fires, a new selection may have
			// replaced the live values.
			pendingCommit.current = { id, transform: readLiveTransform(live) };
			clearTimeout(commitTimer.current);
			commitTimer.current = setTimeout(flushPendingCommit, 250);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!MODIFIER_KEYS.has(event.key)) flushPendingCommit();
		};

		element.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("pointerdown", flushPendingCommit, true);
		window.addEventListener("keydown", handleKeyDown, true);
		return () => {
			element.removeEventListener("wheel", handleWheel);
			window.removeEventListener("pointerdown", flushPendingCommit, true);
			window.removeEventListener("keydown", handleKeyDown, true);
			clearTimeout(commitTimer.current);
			commitTimer.current = undefined;
			pendingCommit.current = null;
		};
	}, [target, live, flushPendingCommit]);

	return flushPendingCommit;
}
