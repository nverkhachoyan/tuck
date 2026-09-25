import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, floatingShadow, radii } from "@/theme";
import type { GlassViewProps } from "./GlassView";

/**
 * A frosted panel floating over the canvas, blurred with CSS. One view does,
 * as a browser never clips an element's own shadow to its corners.
 */
export function GlassView({ style, contentStyle, children }: GlassViewProps) {
	return <View style={[styles.glass, style, contentStyle]}>{children}</View>;
}

/** Fills its parent, or what `style` leaves of it, dimming and blurring. */
export function FrostedBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
	return <View style={[styles.backdrop, style]} />;
}

// React Native's style types lack backdrop filters, which only web has.
const blur = (radius: number) =>
	({
		backdropFilter: `blur(${radius}px) saturate(160%)`,
	}) as unknown as ViewStyle;

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.frostedScrim,
		...blur(14),
	},
	glass: {
		overflow: "hidden",
		borderRadius: radii.panel,
		borderWidth: 1,
		borderColor: colors.glassBorder,
		backgroundColor: colors.glass,
		// A faint light along the top edge, as on a pane of glass.
		boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.05), ${floatingShadow}`,
		...blur(24),
	},
});
