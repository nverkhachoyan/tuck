import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { StyleSheet, Text, View, type ViewInstance } from "react-native";
import { Button } from "@/ui/Button";
import { ColorPicker } from "@/ui/ColorPicker";
import { Popover } from "@/ui/Popover";
import { Surface } from "@/ui/Surface";
import { SwatchChip } from "@/ui/SwatchChip";
import { colors, radii, typography } from "@/ui/theme";
import { ColorSwatches, customSwatch } from "./ColorSwatches";

/**
 * The swatches, and under them a picker for any color, which the custom
 * swatch opens and closes, for a tool's options card. `customColor` is the
 * editor's custom color: the custom swatch shows it, and picks it again
 * when the value isn't custom. A color from the picker goes to
 * `onPickCustom`, which should make it the custom color too, and so should
 * one from the canvas, which `onEyedropper` sets out to pick.
 */
export function ColorOptions({
	value,
	customColor,
	noneLabel,
	onPick,
	onPickCustom,
	onEyedropper,
	onSwatch,
}: {
	value: string | null;
	customColor: string | null;
	noneLabel?: string;
	onPick: (color: string | null) => void;
	onPickCustom: (color: string) => void;
	onEyedropper?: () => void;
	// After a swatch's color is picked, not the custom color's.
	onSwatch?: () => void;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);
	// The picker's color while it's dragged, before it's picked.
	const [draft, setDraft] = useState<string | null>(null);
	const shown = draft ?? value;
	// Opens the picker, or closes it once it's open.
	const custom = customSwatch(shown, customColor, onPick, () =>
		setPickerOpen(true),
	);
	return (
		<>
			<ColorSwatches
				value={shown}
				noneLabel={noneLabel}
				custom={
					pickerOpen
						? { ...custom, onPress: () => setPickerOpen(false) }
						: custom
				}
				onPick={(color) => {
					setPickerOpen(false);
					onPick(color);
					onSwatch?.();
				}}
			/>
			{pickerOpen && (
				<ColorPicker
					value={shown ?? customColor ?? "#FFFFFF"}
					onChange={setDraft}
					onChangeEnd={(color) => {
						setDraft(null);
						onPickCustom(color);
					}}
					onEyedropper={onEyedropper}
				/>
			)}
		</>
	);
}

/**
 * A single row of swatches for a compact dock panel, where the custom swatch
 * opens `ColorPicker` in a popover above the dock rather than expanding inline.
 */
export function ColorSwatchRow({
	value,
	customColor,
	onPick,
	onPickCustom,
	onEyedropper,
}: {
	value: string;
	customColor: string | null;
	onPick: (color: string) => void;
	onPickCustom: (color: string) => void;
	onEyedropper?: () => void;
}) {
	const anchor = useRef<ViewInstance>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [draft, setDraft] = useState<string | null>(null);
	const shown = draft ?? value;
	const custom = customSwatch(shown, customColor, onPick, () =>
		setPickerOpen(true),
	);
	return (
		<>
			<ColorSwatches
				value={shown}
				custom={{ ...custom, anchorRef: anchor }}
				onPick={(color) => {
					setPickerOpen(false);
					if (color) onPick(color);
				}}
			/>
			<Popover
				anchor={anchor}
				open={pickerOpen}
				onClose={() => {
					setDraft(null);
					setPickerOpen(false);
				}}
				label="Custom color"
			>
				<ColorPicker
					value={shown}
					onChange={setDraft}
					onChangeEnd={(color) => {
						setDraft(null);
						onPickCustom(color);
					}}
					onEyedropper={
						onEyedropper &&
						(() => {
							setDraft(null);
							setPickerOpen(false);
							onEyedropper();
						})
					}
				/>
			</Popover>
		</>
	);
}

/**
 * The current color, as a swatch that opens `ColorOptions` in a popover: the
 * swatches, the custom color, and the eyedropper. A swatch closes it (see
 * `BarChip`), while the custom color's picker keeps it open to drag. Starting
 * the eyedropper closes it too, as a tray does, so the canvas is in view. `title` is
 * the word beside the swatch when several chips sit together. `label` is
 * what a screen reader hears.
 */
export function ColorChip({
	label,
	title,
	value,
	customColor,
	noneLabel,
	onPick,
	onPickCustom,
	onEyedropper,
	restoreFocus,
}: {
	label: string;
	// A word beside the swatch, when several chips sit together and the
	// swatch alone doesn't say which color it is. `label` stays the name a
	// screen reader hears.
	title?: string;
	value: string | null;
	customColor: string | null;
	noneLabel?: string;
	onPick: (color: string | null) => void;
	onPickCustom: (color: string) => void;
	onEyedropper?: () => void;
	// Where focus goes when the palette closes, instead of back here.
	restoreFocus?: () => void;
}) {
	return (
		<SwatchChip
			label={label}
			title={title}
			value={value}
			empty="none"
			restoreFocus={restoreFocus}
		>
			{(close) => (
				<ColorOptions
					value={value}
					customColor={customColor}
					noneLabel={noneLabel}
					onPick={onPick}
					onSwatch={close}
					onPickCustom={onPickCustom}
					onEyedropper={
						onEyedropper &&
						(() => {
							close();
							onEyedropper();
						})
					}
				/>
			)}
		</SwatchChip>
	);
}

/**
 * Says the canvas is waiting to be tapped for a color, across its top, with
 * a way out. It doesn't take the canvas's touches.
 */
export function EyedropperHint({ onCancel }: { onCancel: () => void }) {
	return (
		<View style={styles.hintArea}>
			<Surface style={styles.hint} contentStyle={styles.hintContent}>
				<Ionicons name="eyedrop-outline" size={18} color={colors.textPrimary} />
				<Text style={styles.hintText}>Tap the canvas to pick its color</Text>
				<Button label="Cancel" size="small" onPress={onCancel} />
			</Surface>
		</View>
	);
}

const styles = StyleSheet.create({
	hintArea: {
		position: "absolute",
		top: 12,
		left: 12,
		right: 12,
		alignItems: "center",
		pointerEvents: "box-none",
	},
	hint: {
		borderRadius: radii.medium,
	},
	hintContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingLeft: 14,
		paddingRight: 8,
		paddingVertical: 8,
	},
	hintText: {
		...typography.label,
		color: colors.textPrimary,
	},
});
