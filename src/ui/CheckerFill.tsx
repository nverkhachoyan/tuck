import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

type CheckerFillProps = {
	// The parent's size, which this fills.
	width: number;
	height: number;
	// A square's side.
	cell: number;
};

/**
 * The checkerboard that stands for transparency, in plain views, filling
 * its parent (which should clip it). Web draws it with one gradient instead;
 * see `CheckerFill.web.tsx`.
 */
export function CheckerFill({ width, height, cell }: CheckerFillProps) {
	const rows = Math.ceil(height / cell);
	const columns = Math.ceil(width / cell);
	return (
		<View style={styles.fill}>
			{Array.from({ length: rows }, (_, row) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid
				<View key={row} style={styles.row}>
					{Array.from({ length: columns }, (_, column) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid
							key={column}
							style={[
								{ width: cell, height: cell },
								(row + column) % 2 === 1 && styles.light,
							]}
						/>
					))}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	fill: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.checkerDark,
	},
	row: {
		flexDirection: "row",
	},
	light: {
		backgroundColor: colors.checkerLight,
	},
});
