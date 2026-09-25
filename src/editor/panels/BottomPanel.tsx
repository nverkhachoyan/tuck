import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

// Every panel shares one fixed height, above the home indicator, so the
// canvas above never resizes when the selection changes.
const PANEL_HEIGHT = 124;

/** The bar under the canvas, holding the panel for the selection or tool. */
export function BottomPanel({ children }: { children: ReactNode }) {
	const { bottom } = useSafeAreaInsets();

	return (
		<View
			style={[
				styles.panel,
				{ height: PANEL_HEIGHT + bottom, paddingBottom: bottom },
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
});
