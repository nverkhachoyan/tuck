import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/ui/Chip";
import { ColorPicker } from "@/ui/ColorPicker";
import { FadeRow, MeasuredItem } from "@/ui/FadeRow";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { colors, typography, webTransition } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { TEXT_FONTS } from "../../layers/text/fonts";
import {
	type TextAlign,
	type TextFont,
	type TextLayer,
	type TextLayerEdit,
	textFonts,
} from "../../layers/text/text";
import { ColorChip } from "../../shell/ColorOptions";
import { ColorSwatches, customSwatch } from "../../shell/ColorSwatches";
import {
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { ToolOption, ToolOptions } from "../../shell/ToolOptions";
import type { TextColorKey } from "./textSettings";
import type { TextController } from "./useTextTool";

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

const COLOR_NAMES: Record<TextColorKey, string> = {
	color: "Text color",
	outlineColor: "Outline",
	backgroundColor: "Box",
};

const COLOR_TITLES: Record<TextColorKey, string> = {
	color: "Color",
	outlineColor: "Outline",
	backgroundColor: "Box",
};

/** Text's dock panel: the style of the text being typed or selected. */
export function TextDock({ controller: text }: { controller: TextController }) {
	const { styledText } = text;
	return (
		styledText && (
			<TextStylePanel
				layer={styledText}
				onChange={text.style}
				onOpenPicker={text.openPicker}
			/>
		)
	);
}

/**
 * Text's options in the wide header, which put the caret back in the
 * hidden input as a chip closes while text is typed.
 */
export function TextToolBar({
	controller: text,
}: {
	controller: TextController;
}) {
	const { styledText, edit, inputRef } = text;
	return (
		styledText && (
			<TextBar
				layer={styledText}
				onChange={text.style}
				restoreFocus={edit ? () => inputRef.current?.focus() : undefined}
			/>
		)
	);
}

/** The color picker the dock's custom swatch opened, over the canvas. */
export function TextColorResults({
	controller: text,
}: {
	controller: TextController;
}) {
	const { styledText, picker } = text;
	return (
		picker &&
		styledText && (
			<TextColorPicker
				layer={styledText}
				colorKey={picker.key}
				onChange={text.style}
				onClose={text.closePicker}
			/>
		)
	);
}

/**
 * A picker for one of a text layer's colors, in a card over the canvas (see
 * `ToolOptions`), since the dock's panel has no room for one. The text
 * takes the color once the finger lifts; the custom color does too. The
 * eyedropper closes it, so the canvas is in view.
 */
function TextColorPicker({
	layer,
	colorKey,
	onChange,
	onClose,
}: {
	layer: TextLayer;
	colorKey: TextColorKey;
	onChange: (patch: TextLayerEdit) => void;
	onClose: () => void;
}) {
	const { bottomInset } = useEditorContext();
	const { onPickCustom, onEyedropper } = useColorTarget((color) =>
		onChange({ [colorKey]: color }),
	);
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
					onEyedropper={() => {
						onClose();
						onEyedropper();
					}}
				/>
			</ToolOption>
		</ToolOptions>
	);
}

type TextStylePanelProps = {
	layer: TextLayer;
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
function TextStylePanel({
	layer,
	onChange,
	onOpenPicker,
}: TextStylePanelProps) {
	const { customColor } = useEditorContext();
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
				{/* A fresh row for each tab: on web, a swatch that only moves
				    doesn't report its new place to the fade. */}
				<TabContent
					key={tab}
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

/**
 * A text layer's style in the wide editor's header: alignment, then the
 * font, then Color, Outline, and Box. Alignment stays icons. The phone keeps
 * the tabs. `restoreFocus` puts the caret back in the hidden input when a
 * chip closes, and only while text is being typed.
 */
function TextBar({
	layer,
	onChange,
	restoreFocus,
}: {
	layer: TextLayer;
	onChange: (patch: TextLayerEdit) => void;
	restoreFocus?: () => void;
}) {
	const { customColor, setCustomColor, startEyedropper } = useEditorContext();
	const chip = (key: TextColorKey, noneLabel?: string) => (
		<ColorChip
			key={key}
			label={COLOR_NAMES[key]}
			title={COLOR_TITLES[key]}
			value={layer[key]}
			customColor={customColor}
			noneLabel={noneLabel}
			onPick={(color) => {
				if (key === "color" && !color) return;
				onChange({ [key]: color });
			}}
			onPickCustom={(color) => {
				onChange({ [key]: color });
				setCustomColor(color);
			}}
			onEyedropper={() =>
				startEyedropper((color) => onChange({ [key]: color }))
			}
			restoreFocus={restoreFocus}
		/>
	);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Alignment"
					iconsOnly
					options={ALIGNS.map(({ label, icon }) => ({ title: label, icon }))}
					selected={ALIGNS.findIndex((choice) => choice.align === layer.align)}
					onSelect={(index) => {
						const align = ALIGNS[index]?.align;
						if (align && align !== layer.align) onChange({ align });
					}}
				/>
			</BarGroup>
			<BarGroup>
				<FontChip
					font={layer.font}
					onPick={(font) => onChange({ font })}
					restoreFocus={restoreFocus}
				/>
			</BarGroup>
			<BarGroup>
				{chip("color")}
				{chip("outlineColor", "No outline")}
				{chip("backgroundColor", "No background")}
			</BarGroup>
		</BarSections>
	);
}

/** The font in use, opening the previews. */
function FontChip({
	font,
	onPick,
	restoreFocus,
}: {
	font: TextFont;
	onPick: (font: TextFont) => void;
	restoreFocus?: () => void;
}) {
	return (
		<BarChip
			label={FONT_LABELS[font]}
			icon="format-font"
			text={FONT_LABELS[font]}
			textStyle={{ fontFamily: TEXT_FONTS[font].family }}
			restoreFocus={restoreFocus}
		>
			{(close) => (
				<FontPicker
					value={font}
					onPick={(picked) => {
						onPick(picked);
						close();
					}}
				/>
			)}
		</BarChip>
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
	// The custom swatch opens the picker over the canvas: the dock has no room.
	const custom = (key: TextColorKey) =>
		customSwatch(
			layer[key],
			customColor,
			(color) => onChange({ [key]: color }),
			() => onOpenPicker(key),
		);
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
	return (
		<FadeRow style={styles.bleed} contentStyle={styles.swatches}>
			{children}
		</FadeRow>
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
			aria-selected={active}
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
		<FadeRow style={styles.bleed} contentStyle={styles.fonts}>
			{textFonts.map((font) => {
				const selected = font === value;
				return (
					<MeasuredItem key={font}>
						<Chip
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
					</MeasuredItem>
				);
			})}
		</FadeRow>
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
	aligns: {
		flexDirection: "row",
		flexShrink: 0,
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
