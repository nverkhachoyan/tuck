import type { ReactNode, Ref } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { colors } from "@/theme";

// Wide enough to spare a margin around the stage.
const FRAMED_MIN_WIDTH = 600;
const FRAME = 8;

/**
 * The area a canvas sits in, in the screen's own color, so the photo rests
 * on the same surface as the bars around it. It's inset on every side on a
 * wide screen. The editor, the crop tool, and export share it, so the
 * canvas keeps its place between them. `toBottom` runs it down to the
 * screen's edge, under the editor's dock; otherwise something sits below it.
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
		backgroundColor: colors.canvasWell,
	},
	framed: {
		marginHorizontal: FRAME,
	},
	framedBottom: {
		marginBottom: FRAME,
	},
});
