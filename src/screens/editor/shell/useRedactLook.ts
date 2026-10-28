import { useEffect } from "react";
import type { Size } from "@/model/geometry";
import { readPreference, writePreference } from "@/platform/preferenceStore";
import { usePreference } from "@/platform/usePreference";
import {
	parseRedactLook,
	type RedactLook,
	redactionEffect,
} from "./redactLook";

const KEY = "redactLook";
// Where builds before the look had its own key kept it, beside Redact's
// sub-tool and sizes.
const EARLIER_KEY = "redactSettings";

const parseSavedLook = (saved: unknown) =>
	parseRedactLook(saved === undefined ? readPreference(EARLIER_KEY) : saved);

/**
 * How new redactions look, kept between sessions and shared by Redact, Find,
 * and Cut out.
 * - `look` and `changeLook`, which takes any of its parts.
 * - `effectFor(size)`: the effect it redacts with on a canvas of `size`.
 */
export function useRedactLook() {
	const [look, setLook] = usePreference(KEY, parseSavedLook);
	// A look carried over from the earlier key is saved under this one, before
	// Redact saves its settings without it.
	useEffect(() => {
		if (readPreference(KEY) === undefined) writePreference(KEY, look);
	}, [look]);
	const changeLook = (change: Partial<RedactLook>) =>
		setLook((current) => {
			const { effect, color, strength } = { ...current, ...change };
			return { effect, color, strength };
		});
	const effectFor = (size: Size) => redactionEffect(look, size);
	return { look, changeLook, effectFor };
}
