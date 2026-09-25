import { type ReactNode, useState } from "react";
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
import { ColorPicker } from "../ColorPicker";
import { ColorSwatches, isCustomColor } from "../ColorSwatches";
import { ToolOption, ToolOptions } from "../ToolOptions";

// The minimum comfortable touch target. Controls here are boxes this big,
// not smaller views with `hitSlop`, which can't reach past a parent's bounds.
const TARGET = 44;
// The tabs' track, inside their targets.
const TRACK = 34;
// Inside the panel's rounded corners.
const PADDING = 16;

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

/** A text layer's colors, which its Color, Outline, and Box tabs pick. */
export type TextColorKey = "color" | "outlineColor" | "backgroundColor";

const COLOR_NAMES: Record<TextColorKey, string> = {
	color: "Text color",
	outlineColor: "Outline",
	backgroundColor: "Box",
};

/**
 * A picker for one of a text layer's colors, in a card over the canvas (see
 * `ToolOptions`), since the dock's panel has no room for one. The text
 * takes the color once the finger lifts; the custom color does too.
 */
export function TextColorPicker({
	layer,
	colorKey,
	bottomInset,
	onChange,
	onPickCustom,
	onClose,
}: {
	layer: TextLayer;
	colorKey: TextColorKey;
	bottomInset: number;
	onChange: (patch: TextLayerEdit) => void;
	onPickCustom: (color: string) => void;
	onClose: () => void;
}) {
	return (
		<ToolOptions
			closeLabel="Close color picker"
			bottomInset={bottomInset}
			onClose={onClose}
		>
			<ToolOption label={COLOR_NAMES[colorKey]}>
				<ColorPicker
					// An outline or box that's off starts from the text's fill.
					value={layer[colorKey] ?? layer.color}
					onChangeEnd={(color) => {
						onChange({ [colorKey]: color });
						onPickCustom(color);
					}}
				/>
			</ToolOption>
		</ToolOptions>
	);
}

type TextStylePanelProps = {
	layer: TextLayer;
	// The editor's custom color, which the custom swatch shows.
	customColor: string | null;
	onChange: (patch: TextLayerEdit) => void;
	// The custom swatch was tapped: open a picker for one of the colors.
	onOpenPicker: (key: TextColorKey) => void;
	onEdit: () => void;
	onToggleResize: () => void;
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
	customColor,
	onChange,
	onOpenPicker,
	onEdit,
	onToggleResize,
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
						icon="resize-outline"
						label="Stretch text with handles"
						selected={layer.resizable === true}
						onPress={onToggleResize}
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
				<TabContent
					tab={tab}
					layer={layer}
					customColor={customColor}
					onChange={onChange}
					onOpenPicker={onOpenPicker}
				/>
			</View>
		</View>
	);
}

function TabContent({
	tab,
	layer,
	customColor,
	onChange,
	onOpenPicker,
}: {
	tab: Tab;
	layer: TextLayer;
	customColor: string | null;
	onChange: (patch: TextLayerEdit) => void;
	onOpenPicker: (key: TextColorKey) => void;
}) {
	// The custom swatch picks the custom color again, if the value isn't
	// custom, and opens the picker over the canvas: the dock has no room.
	const custom = (key: TextColorKey) => {
		const value = layer[key];
		return {
			color: isCustomColor(value) ? value : customColor,
			onPress: () => {
				if (customColor && !isCustomColor(value)) {
					onChange({ [key]: customColor });
				}
				onOpenPicker(key);
			},
		};
	};
	switch (tab) {
		case "font":
			return (
				<FontPicker value={layer.font} onPick={(font) => onChange({ font })} />
			);
		// Text always has a fill; only the outline and background can be off.
		case "color":
			return (
				<SwatchRow>
					<ColorSwatches
						value={layer.color}
						custom={custom("color")}
						onPick={(color) => color && onChange({ color })}
					/>
				</SwatchRow>
			);
		case "outline":
			return (
				<SwatchRow>
					<ColorSwatches
						value={layer.outlineColor}
						noneLabel="No outline"
						custom={custom("outlineColor")}
						onPick={(outlineColor) => onChange({ outlineColor })}
					/>
				</SwatchRow>
			);
		case "background":
			return (
				<SwatchRow>
					<ColorSwatches
						value={layer.backgroundColor}
						noneLabel="No background"
						custom={custom("backgroundColor")}
						onPick={(backgroundColor) => onChange({ backgroundColor })}
					/>
				</SwatchRow>
			);
	}
}

/**
 * A row of swatches, scrolling edge to edge like the fonts when a phone
 * can't fit them all: with "none" and the custom one, there are eight.
 */
function SwatchRow({ children }: { children: ReactNode }) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.bleed}
			contentContainerStyle={styles.swatches}
		>
			{children}
		</ScrollView>
	);
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
											selected && styles.fontLabelSelected,
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
		paddingHorizontal: PADDING,
		gap: 2,
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
		backgroundColor: "rgba(0, 0, 0, 0.28)",
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
		backgroundColor: colors.chosenSoft,
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
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
		gap: 16,
		paddingRight: 4,
	},
	// One height for every tab, so switching tabs never shifts the row above.
	content: {
		height: TARGET,
		justifyContent: "center",
	},
	// Scrolls edge to edge, past the panel's padding.
	bleed: {
		marginHorizontal: -PADDING,
	},
	fonts: {
		gap: 8,
		paddingHorizontal: PADDING,
	},
	swatches: {
		paddingHorizontal: PADDING,
	},
	fontChip: {
		height: 34,
		paddingHorizontal: 14,
		borderRadius: 17,
		backgroundColor: colors.glassControl,
		justifyContent: "center",
	},
	fontChipHovered: {
		backgroundColor: colors.glassControlHover,
	},
	fontChipSelected: {
		backgroundColor: colors.chosen,
	},
	fontChipPressed: {
		transform: [{ scale: 0.96 }],
	},
	fontLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
	fontLabelSelected: {
		color: colors.onChosen,
	},
});
