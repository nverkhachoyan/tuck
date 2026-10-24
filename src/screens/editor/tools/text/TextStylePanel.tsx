import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ReactNode, useState } from "react";
import {
	Pressable,
	ScrollView,
	type StyleProp,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import {
	type TextAlign,
	type TextFont,
	type TextLayer,
	type TextLayerEdit,
	textFonts,
} from "@/model/layers/text";
import { TEXT_FONTS } from "@/render/fonts";
import { Chip } from "@/ui/Chip";
import { fadeTo } from "@/ui/gradient";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { colors, typography, webTransition } from "@/ui/theme";
import type { TextColorKey } from "../../editorMode";
import { ColorPicker } from "../../shell/ColorPicker";
import { ColorSwatches, isCustomColor } from "../../shell/ColorSwatches";
import { ToolOption, ToolOptions } from "../../shell/ToolOptions";

// The minimum comfortable touch target. Controls here are boxes this big,
// not smaller views with `hitSlop`, which can't reach past a parent's bounds.
const TARGET = 44;
// A tab's label and underline, inside its target.
const TAB_HEIGHT = 30;
// Inside the panel's rounded corners.
const PADDING = 16;

const FONT_LABELS: Record<TextFont, string> = {
	classic: "Classic",
	modern: "Modern",
	serif: "Serif",
	marker: "Marker",
	typewriter: "Typewriter",
};

type Tab = "font" | "color" | "outline" | "background" | "align";

// Short, so every tab fits across a phone.
const TABS: { tab: Tab; label: string }[] = [
	{ tab: "font", label: "Font" },
	{ tab: "color", label: "Color" },
	{ tab: "outline", label: "Outline" },
	{ tab: "background", label: "Box" },
	{ tab: "align", label: "Align" },
];

const ALIGNS: { align: TextAlign; label: string; icon: AlignIcon }[] = [
	{ align: "left", label: "Align left", icon: "format-align-left" },
	{ align: "center", label: "Align center", icon: "format-align-center" },
	{ align: "right", label: "Align right", icon: "format-align-right" },
];

type AlignIcon =
	| "format-align-left"
	| "format-align-center"
	| "format-align-right";

// Where a scrolling row fades out, hinting there's more past the edge: to
// the dock's color (`colors.background`), so a chip under it clearly runs on.
const FADE_WIDTH = 56;

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
	onPickCustom,
	onEyedropper,
	onClose,
}: {
	layer: TextLayer;
	colorKey: TextColorKey;
	bottomInset: number;
	// A color from the picker, for the text, which becomes the editor's
	// custom color too.
	onPickCustom: (color: string) => void;
	// Sets out to pick the color from the canvas.
	onEyedropper: () => void;
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
					onChangeEnd={onPickCustom}
					onEyedropper={onEyedropper}
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
};

/**
 * Styling for the selected text layer, or the text being typed: its font,
 * colors, and alignment. The text itself is edited on the canvas (tap the
 * selected layer, or Edit in the selection bar) and resized there (pinch or
 * the corner handles), and the actions every layer has float by it (see
 * `SelectionBar`). There's no Done button: tapping anywhere on the canvas
 * off the text deselects it, or finishes typing.
 */
export function TextStylePanel({
	layer,
	customColor,
	onChange,
	onOpenPicker,
}: TextStylePanelProps) {
	const [tab, setTab] = useState<Tab>("font");

	return (
		<View style={styles.container}>
			<View style={styles.tabs} accessibilityRole="tablist">
				{TABS.map(({ tab: value, label }) => (
					<Tab
						key={value}
						label={label}
						active={tab === value}
						onPress={() => setTab(value)}
					/>
				))}
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
		case "align":
			return (
				<AlignPicker
					value={layer.align}
					onPick={(align) => onChange({ align })}
				/>
			);
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
	return <ScrollRow contentStyle={styles.swatches}>{children}</ScrollRow>;
}

/**
 * A row that scrolls edge to edge, past the panel's padding, when it's
 * wider than the panel. While more of it is past the right edge, that edge
 * fades out, so the row reads as one that scrolls.
 */
function ScrollRow({
	contentStyle,
	children,
}: {
	contentStyle: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	const [width, setWidth] = useState(0);
	const [contentWidth, setContentWidth] = useState(0);
	const [offset, setOffset] = useState(0);
	const more = contentWidth - offset - width > 1;
	return (
		<View style={styles.bleed}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={contentStyle}
				scrollEventThrottle={32}
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
				onContentSizeChange={(contentWidth) => setContentWidth(contentWidth)}
				onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
			>
				{children}
			</ScrollView>
			{more && <View style={styles.fade} />}
		</View>
	);
}

/** Left, center, and right, each drawn as it lines up text. */
function AlignPicker({
	value,
	onPick,
}: {
	value: TextAlign;
	onPick: (align: TextAlign) => void;
}) {
	return (
		<View style={styles.aligns}>
			{ALIGNS.map(({ align, label, icon }) => {
				const selected = align === value;
				return (
					<Chip
						key={align}
						selected={selected}
						onPress={() => onPick(align)}
						accessibilityLabel={label}
						hitSlop={4}
						style={styles.target}
						frameStyle={[styles.fontChip, styles.alignChip]}
					>
						<MaterialCommunityIcons
							name={icon}
							size={20}
							color={selected ? colors.onHighlight : colors.textPrimary}
						/>
					</Chip>
				);
			})}
		</View>
	);
}

/** One tab; the active one is underlined with the highlighter. */
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
			style={(state) => [
				styles.target,
				styles.tab,
				webTransition,
				interaction(state).hovered && styles.tabHovered,
			]}
		>
			<View style={styles.segment}>
				{active && <Highlight under />}
				<Text style={styles.tabLabel}>{label}</Text>
			</View>
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
		<ScrollRow contentStyle={styles.fonts}>
			{textFonts.map((font) => {
				const selected = font === value;
				return (
					<Chip
						key={font}
						selected={selected}
						onPress={() => onPick(font)}
						accessibilityLabel={FONT_LABELS[font]}
						// Half the gap between chips, so neighbors' targets meet.
						hitSlop={4}
						style={styles.target}
						frameStyle={styles.fontChip}
					>
						<Text
							style={[
								styles.fontLabel,
								selected && styles.fontLabelSelected,
								{ fontFamily: TEXT_FONTS[font].family },
							]}
						>
							{FONT_LABELS[font]}
						</Text>
					</Chip>
				);
			})}
		</ScrollRow>
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
	tabs: {
		flexDirection: "row",
	},
	// Rounded so a browser's focus ring hugs what's drawn inside.
	target: {
		height: TARGET,
		borderRadius: TARGET / 2,
		justifyContent: "center",
	},
	// Sized by its label, then sharing what's left, so a long label like
	// "Outline" isn't squeezed to the width of "Box".
	tab: {
		flexGrow: 1,
	},
	tabHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	// As wide as its label, so the underline is too.
	segment: {
		alignSelf: "center",
		height: TAB_HEIGHT,
		paddingHorizontal: 2,
		justifyContent: "center",
	},
	tabLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
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
	fade: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 0,
		width: FADE_WIDTH,
		pointerEvents: "none",
		...fadeTo("right", colors.background),
	},
	aligns: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 12,
	},
	alignChip: {
		width: 56,
		alignItems: "center",
	},
	fontChip: {
		height: 34,
	},
	fontLabel: {
		fontSize: 16,
		color: colors.textPrimary,
	},
	fontLabelSelected: {
		color: colors.onHighlight,
	},
});
