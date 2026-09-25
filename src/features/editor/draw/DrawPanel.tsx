import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { RingChoice } from "@/ui/RingChoice";
import { ColorOptions } from "../ColorPicker";
import { ToolButton, ToolRow } from "../ToolButton";
import {
	SIZE_DOTS,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../ToolOptions";
import {
	type BrushSettings,
	brushSizeIndex,
	type DrawTool,
	penTip,
} from "./brushSettings";

const TOOLS = [
	{ tool: "pen", label: "Pen", icon: "draw-pen" },
	{ tool: "marker", label: "Marker", icon: "marker" },
	{ tool: "neon", label: "Neon", icon: "shimmer" },
	{ tool: "eraser", label: "Eraser", icon: "eraser" },
] as const;

// The dot on the pen in use, in its color.
const BADGE = 12;

/**
 * The drawing tools, in place of the toolbar while drawing: the pens (plain,
 * marker, and neon) and the eraser. Tapping the tool in use opens its
 * options over the canvas, which the dot of color on a pen's tile hints at.
 * Four tools and the dock's back button are all a phone fits, so there's no
 * separate button for them.
 */
export function DrawPanel({
	settings,
	onChange,
	onToggleOptions,
}: {
	settings: BrushSettings;
	onChange: (settings: BrushSettings) => void;
	onToggleOptions: () => void;
}) {
	const pickTool = (tool: DrawTool) => {
		if (tool === settings.tool) onToggleOptions();
		else onChange({ ...settings, tool });
	};
	return (
		<ToolRow>
			{TOOLS.map(({ tool, label, icon }) => {
				const inUse = settings.tool === tool;
				return (
					<ToolButton
						key={tool}
						label={label}
						icon={icon}
						glyph={
							inUse && tool !== "eraser" ? (
								<View>
									<MaterialCommunityIcons
										name={icon}
										size={24}
										color={colors.textPrimary}
									/>
									<View
										style={[styles.badge, { backgroundColor: settings.color }]}
									/>
								</View>
							) : undefined
						}
						selected={inUse}
						onPress={() => pickTool(tool)}
					/>
				);
			})}
		</ToolRow>
	);
}

/**
 * The brush's color and size, in a card over the canvas (see `ToolOptions`).
 * The custom swatch opens a picker for any color (see `ColorOptions`).
 */
export function BrushOptions({
	settings,
	customColor,
	bottomInset,
	onChange,
	onPickCustom,
	onClose,
}: {
	settings: BrushSettings;
	customColor: string | null;
	bottomInset: number;
	onChange: (settings: BrushSettings) => void;
	// A color from the picker, which becomes the editor's custom color.
	onPickCustom: (color: string) => void;
	onClose: () => void;
}) {
	const eraser = settings.tool === "eraser";
	const tip = penTip(settings.tool);
	const pickSize = (size: number) =>
		onChange({
			...settings,
			sizes: { ...settings.sizes, [settings.tool]: size },
		});

	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			onClose={onClose}
		>
			{!eraser && (
				<ToolOption label="Color">
					<ColorOptions
						value={settings.color}
						customColor={customColor}
						onPick={(color) => color && onChange({ ...settings, color })}
						onPickCustom={onPickCustom}
					/>
				</ToolOption>
			)}
			<ToolOption label="Size">
				<ToolChoices>
					{SIZE_DOTS.map((dot, index) => (
						<RingChoice
							key={dot}
							label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
							selected={index === brushSizeIndex(settings)}
							onPress={() => pickSize(index)}
						>
							<SizeDot
								size={dot}
								color={eraser ? null : settings.color}
								tip={tip}
							/>
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
		</ToolOptions>
	);
}

const styles = StyleSheet.create({
	badge: {
		position: "absolute",
		right: -BADGE / 2,
		bottom: -BADGE / 3,
		width: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 2,
		borderColor: colors.surface,
	},
});
