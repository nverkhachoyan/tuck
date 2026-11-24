import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
	type DerivedValue,
	useAnimatedReaction,
} from "react-native-reanimated";
import type { SkPath } from "react-native-skia";

const web = Platform.OS === "web";

// Runs `then` once the canvas has drawn two more frames, since it draws the
// recording before an update for a frame more. A worklet, for the reaction
// below, though only web calls it.
function afterTwoFrames(then: () => void) {
	"worklet";
	requestAnimationFrame(() => requestAnimationFrame(then));
}

/**
 * `path`, noted in `built` (from `usePathsBuilt`) on web. A worklet, to wrap
 * what a derived value builds.
 */
export function noted<T extends SkPath | null>(built: SkPath[], path: T): T {
	"worklet";
	if (web && path) built.push(path);
	return path;
}

/** The paths a view's derived values build, noted with `noted`. */
export function usePathsBuilt(): SkPath[] {
	const [built] = useState<SkPath[]>(() => []);
	return built;
}

/**
 * On web a path stays in CanvasKit's heap, which never shrinks, until it's
 * disposed (on native the runtime collects it). A view whose derived values
 * build a path each frame notes each one in `built`:
 * - every one but the derived values' current paths is freed as they
 *   change, since a reaction never sees a derived value's first path, or
 *   one replaced between two of its runs;
 * - the rest are freed once the view goes.
 */
export function useFreeReplaced(
	built: SkPath[],
	path: DerivedValue<SkPath>,
	outline: DerivedValue<SkPath> = path,
) {
	useAnimatedReaction(
		() => (web ? [path.value, outline.value] : null),
		(now) => {
			if (!now) return;
			const stale = built.filter((each) => !now.includes(each));
			if (stale.length === 0) return;
			built.length = 0;
			built.push(...new Set(now));
			afterTwoFrames(() => {
				for (const each of new Set(stale)) each.dispose();
			});
		},
	);
	// Kept across a remount, as development's strict mode does.
	const mounted = useRef(false);
	useEffect(() => {
		if (!web) return;
		mounted.current = true;
		return () => {
			mounted.current = false;
			afterTwoFrames(() => {
				if (mounted.current) return;
				for (const each of new Set(built.splice(0))) each.dispose();
			});
		};
	}, [built]);
}
