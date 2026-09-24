import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TEXT_FONTS } from "@/layers/fonts";
import {
	type TextFont,
	type TextLayer,
	type TextLayerEdit,
	textFonts,
} from "@/model/document";
import { colors } from "@/theme";
import { IconButton } from "@/ui/IconButton";

// The minimum comfortable touch target. Controls here are boxes this big,
// not smaller views with `hitSlop`, which can't reach past a parent's bounds.
const TARGET = 44;
const SWATCH_SIZE = 28;

const SWATCHES = [
	{ color: "#FFFFFF", name: "White" },
	{ color: "#000000", name: "Black" },
	{ color: "#FF3B30", name: "Red" },
	{ color: "#FFD60A", name: "Yellow" },
	{ color: "#34C759", name: "Green" },
	{ color: "#0A84FF", name: "Blue" },
];

const FONT_LABELS: Record<TextFont, string> = {
	classic: "Classic",
	modern: "Modern",
	serif: "Serif",
	marker: "Marker",
	typewriter: "Typewriter",
};

type Tab = "font" | "color" | "outline" | "background";

const TABS: { tab: Tab; label: string }[] = [
	{ tab: "font", label: "Font" },
	{ tab: "color", label: "Color" },
	{ tab: "outline", label: "Outline" },
	{ tab: "background", label: "Background" },
];

type TextEditPanelProps = {
	layer: TextLayer;
	onChange: (patch: TextLayerEdit) => void;
	onDuplicate: () => void;
	onDelete: () => void;
};

/**
 * Styling for the selected text layer. The text itself is edited full-screen
 * (tap the selected layer) and resized on the canvas (pinch or the corner
 * handles), so this is font and colors. There's no Done button: tapping
 * anywhere on the canvas off the text deselects it.
 */
export function TextEditPanel({
	layer,
	onChange,
	onDuplicate,
	onDelete,
}: TextEditPanelProps) {
	const [tab, setTab] = useState<Tab>("font");

	return (
		<View style={styles.container}>
			<View style={styles.row}>
				{/* Scrolls when a narrow screen can't fit every tab. */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={styles.tabsScroll}
					contentContainerStyle={styles.tabs}
				>
					{TABS.map(({ tab: value, label }) => (
						<Tab
							key={value}
							label={label}
							active={tab === value}
							onPress={() => setTab(value)}
						/>
					))}
				</ScrollView>
				<View style={styles.actions}>
					<IconButton
						icon="copy-outline"
						label="Duplicate"
						onPress={onDuplicate}
					/>
					<IconButton
						icon="trash-outline"
						label="Delete"
						tone="danger"
						onPress={onDelete}
					/>
				</View>
			</View>

			<View style={styles.content}>
				<TabContent tab={tab} layer={layer} onChange={onChange} />
			</View>
		</View>
	);
}

function TabContent({
	tab,
	layer,
	onChange,
}: {
	tab: Tab;
	layer: TextLayer;
	onChange: (patch: TextLayerEdit) => void;
}) {
	switch (tab) {
		case "font":
			return (
				<FontPicker value={layer.font} onPick={(font) => onChange({ font })} />
			);
		// Text always has a fill; only the outline and background can be off.
		case "color":
			return (
				<Swatches
					value={layer.color}
					onPick={(color) => color && onChange({ color })}
				/>
			);
		case "outline":
			return (
				<Swatches
					value={layer.outlineColor}
					noneLabel="No outline"
					onPick={(outlineColor) => onChange({ outlineColor })}
				/>
			);
		case "background":
			return (
				<Swatches
					value={layer.backgroundColor}
					noneLabel="No background"
					onPick={(backgroundColor) => onChange({ backgroundColor })}
				/>
			);
	}
}

function Tab({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={8}
			onPress={onPress}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			style={styles.target}
		>
			<Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

/** Each font's name, drawn in that font. */
function FontPicker({
	value,
	onPick,
}: {
	value: TextFont;
	onPick: (font: TextFont) => void;
}) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.bleed}
			contentContainerStyle={styles.fonts}
		>
			{textFonts.map((font) => {
				const selected = font === value;
				return (
					<Pressable
						key={font}
						// Half the gap between chips, so neighbors' targets meet.
						hitSlop={4}
						onPress={() => onPick(font)}
						accessibilityRole="button"
						accessibilityLabel={FONT_LABELS[font]}
						accessibilityState={{ selected }}
						style={styles.target}
					>
						<View
							style={[styles.fontChip, selected && styles.fontChipSelected]}
						>
							<Text
								style={[
									styles.fontLabel,
									{ fontFamily: TEXT_FONTS[font].family },
								]}
							>
								{FONT_LABELS[font]}
							</Text>
						</View>
					</Pressable>
				);
			})}
		</ScrollView>
	);
}

/** The color swatches, led by a "none" swatch when `noneLabel` is given. */
function Swatches({
	value,
	noneLabel,
	onPick,
}: {
	value: string | null;
	noneLabel?: string;
	onPick: (color: string | null) => void;
}) {
	return (
		<View style={styles.swatches}>
			{noneLabel && (
				<Swatch
					color={null}
					label={noneLabel}
					selected={value === null}
					onPress={() => onPick(null)}
				/>
			)}
			{SWATCHES.map(({ color, name }) => (
				<Swatch
					key={color}
					color={color}
					label={name}
					selected={value === color}
					onPress={() => onPick(color)}
				/>
			))}
		</View>
	);
}

/** A color choice; `null` is the "none" swatch, drawn with a slash. */
function Swatch({
	color,
	label,
	selected,
	onPress,
}: {
	color: string | null;
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected }}
			style={styles.swatchTarget}
		>
			<View
				style={[
					styles.swatch,
					color !== null && { backgroundColor: color },
					selected && styles.swatchSelected,
				]}
			>
				{color === null && <View style={styles.swatchSlash} />}
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Small, because the rows' touch targets already leave room around what's
	// drawn in them.
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 20,
		gap: 2,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	tabsScroll: {
		flex: 1,
	},
	tabs: {
		gap: 16,
	},
	// Rounded so a browser's focus ring hugs what's drawn inside.
	target: {
		height: TARGET,
		borderRadius: TARGET / 2,
		justifyContent: "center",
	},
	tabLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	tabLabelActive: {
		color: colors.textPrimary,
	},
	actions: {
		flexDirection: "row",
		gap: 24,
	},
	// One height for every tab, so switching tabs never shifts the row above.
	content: {
		height: TARGET,
		justifyContent: "center",
	},
	// Scrolls edge to edge, past the panel's padding.
	bleed: {
		marginHorizontal: -20,
	},
	fonts: {
		gap: 8,
		paddingHorizontal: 20,
	},
	fontChip: {
		height: 34,
		paddingHorizontal: 14,
		borderRadius: 17,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		justifyContent: "center",
	},
	fontChipSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	fontLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
	// Lines the first swatch up with the panel's edge, past its target's margin.
	swatches: {
		flexDirection: "row",
		marginHorizontal: -(TARGET - SWATCH_SIZE) / 2,
	},
	swatchTarget: {
		width: TARGET,
		height: TARGET,
		borderRadius: TARGET / 2,
		alignItems: "center",
		justifyContent: "center",
	},
	swatch: {
		width: SWATCH_SIZE,
		height: SWATCH_SIZE,
		borderRadius: SWATCH_SIZE / 2,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	swatchSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	swatchSlash: {
		width: 36,
		height: 2,
		backgroundColor: colors.textSecondary,
		transform: [{ rotate: "-45deg" }],
	},
});
