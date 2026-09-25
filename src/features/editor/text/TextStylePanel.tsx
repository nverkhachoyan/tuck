import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TEXT_FONTS } from "@/layers/fonts";
import {
	type TextFont,
	type TextLayer,
	type TextLayerEdit,
	textFonts,
} from "@/model/document";
import { colors, webTransition } from "@/theme";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { ColorSwatches } from "../ColorSwatches";

// The minimum comfortable touch target. Controls here are boxes this big,
// not smaller views with `hitSlop`, which can't reach past a parent's bounds.
const TARGET = 44;
// The tabs' track, inside their targets.
const TRACK = 34;

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
	// Short, so every tab fits beside the actions on a phone.
	{ tab: "background", label: "Box" },
];

type TextStylePanelProps = {
	layer: TextLayer;
	onChange: (patch: TextLayerEdit) => void;
	onEdit: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
};

/**
 * Styling for the selected text layer. The text itself is edited full-screen
 * (Edit, or tap the selected layer) and resized on the canvas (pinch or the
 * corner handles), so this is font and colors. There's no Done button:
 * tapping anywhere on the canvas off the text deselects it.
 */
export function TextStylePanel({
	layer,
	onChange,
	onEdit,
	onDuplicate,
	onDelete,
}: TextStylePanelProps) {
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
					<View style={styles.track} />
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
						icon="create-outline"
						label="Edit text"
						onPress={onEdit}
					/>
					<IconButton
						icon="copy-outline"
						label="Duplicate"
						shortcut="mod+D"
						onPress={onDuplicate}
					/>
					<IconButton
						icon="trash-outline"
						label="Delete"
						shortcut="Delete"
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
				<ColorSwatches
					value={layer.color}
					onPick={(color) => color && onChange({ color })}
				/>
			);
		case "outline":
			return (
				<ColorSwatches
					value={layer.outlineColor}
					noneLabel="No outline"
					onPick={(outlineColor) => onChange({ outlineColor })}
				/>
			);
		case "background":
			return (
				<ColorSwatches
					value={layer.backgroundColor}
					noneLabel="No background"
					onPick={(backgroundColor) => onChange({ backgroundColor })}
				/>
			);
	}
}

/** One segment of the tabs' track; the active one is raised out of it. */
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
			onPress={onPress}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			style={styles.target}
		>
			{(state) => {
				const { hovered } = interaction(state);
				return (
					<View
						style={[
							styles.segment,
							webTransition,
							active && styles.segmentActive,
						]}
					>
						<Text
							style={[
								styles.tabLabel,
								(active || hovered) && styles.tabLabelActive,
							]}
						>
							{label}
						</Text>
					</View>
				);
			}}
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
						{(state) => {
							const { pressed, hovered } = interaction(state);
							return (
								<View
									style={[
										styles.fontChip,
										webTransition,
										hovered && styles.fontChipHovered,
										selected && styles.fontChipSelected,
										pressed && styles.fontChipPressed,
									]}
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
							);
						}}
					</Pressable>
				);
			})}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	// Small, because the rows' touch targets already leave room around what's
	// drawn in them.
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 20,
		gap: 4,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	tabsScroll: {
		flex: 1,
	},
	tabs: {
		paddingHorizontal: (TARGET - TRACK) / 2,
	},
	// Behind the tabs, which are taller to be easy to hit. As wide as the
	// content, not the scroll view.
	track: {
		position: "absolute",
		top: (TARGET - TRACK) / 2,
		bottom: (TARGET - TRACK) / 2,
		left: 0,
		right: 0,
		borderRadius: TRACK / 2,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	// Rounded so a browser's focus ring hugs what's drawn inside.
	target: {
		height: TARGET,
		borderRadius: TARGET / 2,
		justifyContent: "center",
	},
	segment: {
		height: TRACK - 6,
		paddingHorizontal: 11,
		borderRadius: (TRACK - 6) / 2,
		justifyContent: "center",
	},
	segmentActive: {
		backgroundColor: colors.surfacePressed,
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
	},
	tabLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	tabLabelActive: {
		color: colors.textPrimary,
	},
	actions: {
		flexDirection: "row",
		gap: 18,
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
	fontChipHovered: {
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceHover,
	},
	fontChipSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentSoft,
	},
	fontChipPressed: {
		transform: [{ scale: 0.96 }],
	},
	fontLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
});
