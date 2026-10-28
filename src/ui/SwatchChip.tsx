import { type ReactNode, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckerFill } from "./CheckerFill";
import { compactControls } from "./density";
import { interaction } from "./interaction";
import { Popover } from "./Popover";
import { colors, radii, typography, webTransition } from "./theme";

// As tall as the context bar's other options.
const CHIP = compactControls ? 36 : 44;
const CHIP_SWATCH = 20;

/**
 * A color as a round swatch, with an optional word beside it, that opens its
 * choices in a popover, for the context bar.
 * - `value` null draws as a slash for no color (`empty: "none"`) or as the
 *   checkerboard for transparent (`empty: "transparent"`).
 * - `children` gets `close`, to close once a choice is made.
 * - `label` is what a screen reader hears, for the chip and its popover.
 */
export function SwatchChip({
	label,
	title,
	value,
	empty,
	restoreFocus,
	children,
}: {
	label: string;
	title?: string;
	value: string | null;
	empty: "none" | "transparent";
	// Where focus goes when the popover closes, instead of back here.
	restoreFocus?: () => void;
	children: (close: () => void) => ReactNode;
}) {
	const anchor = useRef<View>(null);
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);
	return (
		<>
			<Pressable
				ref={anchor}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ expanded: open }}
				aria-expanded={open}
				onPress={() => setOpen((shown) => !shown)}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.chip,
						title ? styles.chipTitled : styles.chipRound,
						webTransition,
						hovered && styles.chipHovered,
						pressed && styles.chipPressed,
					];
				}}
			>
				{title && <Text style={styles.chipTitle}>{title}</Text>}
				<View
					style={[
						styles.chipSwatch,
						value !== null
							? { backgroundColor: value }
							: empty === "none" && styles.chipEmpty,
					]}
				>
					{value === null &&
						(empty === "none" ? (
							<View style={styles.chipSlash} />
						) : (
							<CheckerFill
								width={CHIP_SWATCH}
								height={CHIP_SWATCH}
								cell={CHIP_SWATCH / 2}
							/>
						))}
				</View>
			</Pressable>
			<Popover
				anchor={anchor}
				open={open}
				onClose={close}
				label={label}
				restoreFocus={restoreFocus}
			>
				{children(close)}
			</Popover>
		</>
	);
}

const styles = StyleSheet.create({
	chip: {
		height: CHIP,
		alignItems: "center",
		justifyContent: "center",
	},
	chipRound: {
		width: CHIP,
		borderRadius: CHIP / 2,
	},
	chipHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	chipPressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	chipTitled: {
		flexDirection: "row",
		gap: 6,
		paddingHorizontal: 12,
		borderRadius: radii.small,
	},
	chipTitle: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	chipSwatch: {
		width: CHIP_SWATCH,
		height: CHIP_SWATCH,
		borderRadius: CHIP_SWATCH / 2,
		borderWidth: 1,
		borderColor: colors.swatchRing,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	chipEmpty: {
		backgroundColor: colors.surface,
	},
	chipSlash: {
		width: 28,
		height: 2,
		backgroundColor: colors.textSecondary,
		transform: [{ rotate: "-45deg" }],
	},
});
