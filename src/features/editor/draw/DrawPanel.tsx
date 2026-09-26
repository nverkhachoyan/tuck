import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { shapeKinds } from "@/model/document";
import { colors } from "@/theme";
import { RingChoice } from "@/ui/RingChoice";
import { ColorOptions } from "../ColorPicker";
import { SHAPE_ICONS, SHAPE_NAMES } from "../shapeIcons";
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
	{ tool: "pen", label: "Pen" },
	{ tool: "marker", label: "Marker" },
	{ tool: "neon", label: "Neon" },
	{ tool: "shape", label: "Shape" },
	{ tool: "eraser", label: "Eraser" },
] as const;

const TOOL_ICONS = {
	pen: "draw-pen",
	marker: "marker",
	neon: "shimmer",
	eraser: "eraser",
} as const;

// The dot on the pen or shape in use, in its color.
const BADGE = 12;

/**
 * The drawing tools, in place of the toolbar while drawing: the pens (plain,
 * marker, and neon), the shapes, which show the one they drag out, and the
 * eraser. Tapping the tool in use opens its options over the canvas, which
 * the dot of color on its tile hints at. The tools and the dock's back
 * button fill a phone, so there's no separate button for them.
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
			{TOOLS.map(({ tool, label }) => {
				const inUse = settings.tool === tool;
				const icon =
					tool === "shape" ? SHAPE_ICONS[settings.shape] : TOOL_ICONS[tool];
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
 * The brush's color and size, and the shape tool's kind, in a card over the
 * canvas (see `ToolOptions`). The custom swatch opens a picker for any color
 * (see `ColorOptions`).
 */
export function BrushOptions({
	settings,
	customColor,
	bottomInset,
	onChange,
	onPickCustom,
	onEyedropper,
	onClose,
}: {
	settings: BrushSettings;
	customColor: string | null;
	bottomInset: number;
	onChange: (settings: BrushSettings) => void;
	// A color from the picker, which becomes the editor's custom color.
	onPickCustom: (color: string) => void;
	// Sets out to pick the brush's color from the canvas.
	onEyedropper: () => void;
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
			{settings.tool === "shape" && (
				<ToolOption label="Shape">
					<ToolChoices>
						{shapeKinds.map((shape) => (
							<RingChoice
								key={shape}
								label={SHAPE_NAMES[shape]}
								selected={settings.shape === shape}
								onPress={() => onChange({ ...settings, shape })}
							>
								<MaterialCommunityIcons
									name={SHAPE_ICONS[shape]}
									size={22}
									color={colors.textPrimary}
								/>
							</RingChoice>
						))}
					</ToolChoices>
				</ToolOption>
			)}
			{!eraser && (
				<ToolOption label="Color">
					<ColorOptions
						value={settings.color}
						customColor={customColor}
						onPick={(color) => color && onChange({ ...settings, color })}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
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
