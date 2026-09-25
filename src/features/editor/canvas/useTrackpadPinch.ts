import { type RefObject, useCallback, useEffect, useRef } from "react";
import { Platform, type View } from "react-native";
import type { Transform } from "@/model/geometry";
import {
	clampScale,
	type LiveTransform,
	readLiveTransform,
} from "./liveTransform";

/**
 * Scales the selected layer with a trackpad pinch on web, which browsers
 * report as wheel events with `ctrlKey` set (so does Ctrl + mouse wheel).
 * A pinch has no end event, so the result commits once the wheel goes quiet.
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
			live.scale.value = clampScale(
				live.scale.value * Math.exp(-event.deltaY * 0.01),
			);
			// Captured now: by the time the timer fires, a new selection may have
			// replaced the live values.
			pendingCommit.current = { id, transform: readLiveTransform(live) };
			clearTimeout(commitTimer.current);
			commitTimer.current = setTimeout(flushPendingCommit, 250);
		};

		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => {
			element.removeEventListener("wheel", handleWheel);
			clearTimeout(commitTimer.current);
			commitTimer.current = undefined;
			pendingCommit.current = null;
		};
	}, [target, live, flushPendingCommit]);

	return flushPendingCommit;
}
