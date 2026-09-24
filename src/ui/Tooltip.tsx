import type { ReactNode, RefObject } from "react";
import type { View } from "react-native";

export type TooltipAnchorProps = {
	ref?: RefObject<View | null>;
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
): { anchor: TooltipAnchorProps; tooltip: ReactNode } {
	return { anchor: {}, tooltip: null };
}
