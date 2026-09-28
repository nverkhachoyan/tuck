import type { ReactNode, Ref } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { colors, radii } from "@/theme";

// Wide enough to spare a margin around the stage.
const FRAMED_MIN_WIDTH = 600;
const FRAME = 8;

/**
 * The well a canvas sits in, set into the screen with corners that echo a
 * phone's own, and inset on every side on a wide screen. The editor, the
 * crop tool, and export share it, so the canvas keeps its place between
 * them. `toBottom` runs it down to the screen's edge, under panels floating
 * over it; otherwise something sits below it.
 */
export function CanvasStage({
	ref,
	toBottom = false,
	children,
}: {
	ref?: Ref<View>;
	toBottom?: boolean;
	children: ReactNode;
}) {
	const framed = useWindowDimensions().width >= FRAMED_MIN_WIDTH;
	return (
		<View
			ref={ref}
			style={[
				styles.stage,
				framed && styles.framed,
				framed && toBottom && styles.framedBottom,
				!framed && toBottom && styles.squareBottom,
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	stage: {
		flex: 1,
		overflow: "hidden",
		borderRadius: radii.extraLarge,
		borderCurve: "continuous",
		backgroundColor: colors.canvasWell,
	},
	framed: {
		marginHorizontal: FRAME,
	},
	framedBottom: {
		marginBottom: FRAME,
	},
	// The screen's own corners round it off.
	squareBottom: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
});
