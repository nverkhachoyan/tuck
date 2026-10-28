import type { ReactNode, RefObject } from "react";
import type { ViewInstance } from "react-native";

/** Where the label shows: below the control, or beside it on its right. */
export type TooltipSide = "below" | "right";

export type TooltipAnchorProps = {
	ref?: RefObject<ViewInstance | null>;
	onHoverIn?: () => void;
	onHoverOut?: () => void;
	onPressIn?: () => void;
};

/**
 * A hover label for an icon-only control, with its keyboard shortcut (like
 * "mod+shift+Z"). Spread `anchor` on the control's Pressable and render
 * `tooltip` beside it. Touch screens have no hover, so on native this is
 * nothing; see `Tooltip.web.tsx`.
 */
export function useTooltip(
	_text: string,
	_shortcut?: string,
	_side?: TooltipSide,
): { anchor: TooltipAnchorProps; tooltip: ReactNode } {
	return { anchor: {}, tooltip: null };
}

/** A shortcut as this platform writes it; only web shows them. */
export function formatShortcut(shortcut: string) {
	return shortcut;
}
