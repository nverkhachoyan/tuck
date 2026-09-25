import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii } from "@/theme";
import { GlassView } from "@/ui/GlassView";

// Every panel shares one fixed height, so the canvas, fitted above the dock,
// never moves when the selection changes.
const DOCK_HEIGHT = 104;
// Wide enough for the text panel's tabs and actions side by side.
const DOCK_MAX_WIDTH = 520;
// From the canvas's sides, and from its bottom where nothing's in the way.
const DOCK_MARGIN = 10;
const PANEL_IN = FadeIn.duration(220).easing(Easing.bezier(0.2, 0, 0, 1));
const PANEL_OUT = FadeOut.duration(120);

/**
 * How far up from the canvas's bottom edge the dock reaches, space under it
 * included. The canvas fits the document above this, and anything placed
 * along the canvas's bottom sits over it.
 */
export function useBottomPanelInset(): number {
	const { bottom } = useSafeAreaInsets();
	return dockBottom(bottom) + DOCK_HEIGHT;
}

// Over the home indicator's area, though clear of the indicator itself.
function dockBottom(safeAreaBottom: number) {
	return Math.max(DOCK_MARGIN, safeAreaBottom - 8);
}

/**
 * The frosted dock floating over the bottom of the canvas, holding the panel
 * for the selection or tool. Changing `panel` cross-fades to the new one;
 * the same panel for another layer stays put.
 */
export function BottomPanel({
	panel,
	children,
}: {
	panel: string;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();

	return (
		<View style={[styles.area, { bottom: dockBottom(bottom) }]}>
			<GlassView style={styles.dock}>
				<Animated.View
					key={panel}
					entering={PANEL_IN}
					exiting={PANEL_OUT}
					style={StyleSheet.absoluteFill}
				>
					{children}
				</Animated.View>
			</GlassView>
		</View>
	);
}

const styles = StyleSheet.create({
	area: {
		position: "absolute",
		left: DOCK_MARGIN,
		right: DOCK_MARGIN,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	dock: {
		width: "100%",
		maxWidth: DOCK_MAX_WIDTH,
		height: DOCK_HEIGHT,
		borderRadius: radii.panel,
	},
});
