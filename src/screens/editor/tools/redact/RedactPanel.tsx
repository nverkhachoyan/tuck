import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { RingChoice } from "@/ui/RingChoice";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, typography, webTransition } from "@/ui/theme";
import { ColorOptions } from "../../shell/ColorPicker";
import { OptionSegments } from "../../shell/ContextBar";
import {
	PixelSquare,
	RedactLook,
	STRENGTH_NAMES,
	StrengthDot,
} from "../../shell/redactStyle";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import { TOOL_KEYS } from "../../shortcuts";
import type { RedactSettings, RedactTool } from "./redactSettings";

const EFFECT_NAMES: Record<RedactSettings["effect"], string> = {
	solid: "Solid",
	blur: "Blur",
	pixelate: "Pixelate",
};

/**
 * The redact tools, in place of the toolbar while redacting: a box to drag
 * out, a brush, Find (with a photo to look in, for faces and text), the
 * brush's eraser, and their style, which opens over the canvas. Tapping the
 * tool that's in use opens the style too.
 */
export function RedactPanel({
	settings,
	optionsOpen,
	onChange,
	onToggleOptions,
	onFind,
}: {
	settings: RedactSettings;
	optionsOpen: boolean;
	onChange: (settings: RedactSettings) => void;
	onToggleOptions: () => void;
	onFind?: () => void;
}) {
	const pickTool = (tool: RedactTool) => {
		if (tool === settings.tool) onToggleOptions();
		else onChange({ ...settings, tool });
	};
	return (
		<ToolRow>
			<ToolButton
				label="Box"
				icon="rectangle-outline"
				selected={settings.tool === "box"}
				onPress={() => pickTool("box")}
			/>
			<ToolButton
				label="Brush"
				icon="brush"
				selected={settings.tool === "brush"}
				onPress={() => pickTool("brush")}
			/>
			{onFind && (
				<ToolButton
					label="Find"
					icon="image-search-outline"
					shortcut={TOOL_KEYS.find}
					onPress={onFind}
				/>
			)}
			<ToolButton
				label="Eraser"
				icon="eraser"
				selected={settings.tool === "eraser"}
				onPress={() => pickTool("eraser")}
			/>
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<EffectGlyph settings={settings} effect={settings.effect} />}
				open={optionsOpen}
				onPress={onToggleOptions}
			/>
		</ToolRow>
	);
}

const REDACT_TOOLS = [
	{ title: "Box" },
	{ title: "Brush" },
	{ title: "Eraser" },
];
/**
 * Redact's options in the wide editor's header: Box, Brush, and Eraser, Find
 * when there's a photo to look in, then the effect and its strength or color,
 * and a size for the brush and eraser. Choosing the sub-tool already in use
 * leaves it, since the options stay in view.
 */
export function RedactBar({
	settings,
	customColor,
	onChange,
	onPickCustom,
	onEyedropper,
	onFind,
}: {
	settings: RedactSettings;
	customColor: string | null;
	onChange: (settings: RedactSettings) => void;
	onPickCustom: (color: string) => void;
	onEyedropper: () => void;
	onFind?: () => void;
}) {
	const { tool } = settings;
	const selected = tool === "brush" ? 1 : tool === "eraser" ? 2 : 0;
	const brush = tool === "brush";
	const pickSize = (size: number) =>
		onChange(
			brush
				? { ...settings, brushSize: size }
				: { ...settings, eraserSize: size },
		);
	return (
		<>
			<OptionSegments
				label="Redact tool"
				options={REDACT_TOOLS}
				selected={selected}
				onSelect={(index) => {
					const next = (["box", "brush", "eraser"] as const)[index];
					if (!next || next === tool) return;
					onChange({ ...settings, tool: next });
				}}
			/>
			{onFind && <FindButton onPress={onFind} />}
			{tool !== "eraser" && (
				<RedactLook
					settings={settings}
					customColor={customColor}
					onChange={onChange}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			)}
			{tool !== "box" && (
				<SizeChoices
					nowrap
					index={brush ? settings.brushSize : settings.eraserSize}
					color={brush ? colors.textPrimary : null}
					onPick={pickSize}
				/>
			)}
		</>
	);
}

/** Find, beside Redact's sub-tools: it leaves Redact for the scan. */
function FindButton({ onPress }: { onPress: () => void }) {
	const { anchor, tooltip } = useTooltip("Find", TOOL_KEYS.find);
	return (
		<>
			<Pressable
				{...anchor}
				accessibilityRole="button"
				accessibilityLabel="Find"
				onPress={onPress}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.find,
						webTransition,
						hovered && styles.findHovered,
						pressed && styles.findPressed,
					];
				}}
			>
				<MaterialCommunityIcons
					name="image-search-outline"
					size={20}
					color={colors.textPrimary}
				/>
				<Text style={styles.findLabel}>Find</Text>
			</Pressable>
			{tooltip}
		</>
	);
}

/**
 * How the redaction looks, and the brush's size, in a tray above the dock
 * (see `ToolOptions`). A box has no size, and an eraser no look.
 */
export function RedactOptions({
	settings,
	customColor,
	bottomInset,
	onChange,
	onPickCustom,
	onEyedropper,
	onClose,
}: {
	settings: RedactSettings;
	customColor: string | null;
	bottomInset: number;
	onChange: (settings: RedactSettings) => void;
	// A color from the picker, which becomes the editor's custom color.
	onPickCustom: (color: string) => void;
	// Sets out to pick the redaction's color from the canvas.
	onEyedropper: () => void;
	onClose: () => void;
}) {
	const { tool, effect } = settings;
	const brush = tool === "brush";
	const pickSize = (size: number) =>
		onChange(
			brush
				? { ...settings, brushSize: size }
				: { ...settings, eraserSize: size },
		);
	return (
		<ToolOptions
			closeLabel="Close redaction style"
			bottomInset={bottomInset}
			onClose={onClose}
			dismissOnOutsidePress={false}
		>
			{tool !== "eraser" && (
				<>
					<ToolOption label="Effect">
						<ToolChoices>
							{(["solid", "blur", "pixelate"] as const).map((choice) => (
								<EffectChoice
									key={choice}
									label={EFFECT_NAMES[choice]}
									selected={effect === choice}
									onPress={() => onChange({ ...settings, effect: choice })}
								>
									<EffectGlyph
										settings={settings}
										effect={choice}
										color={effect === choice ? colors.onHighlight : undefined}
									/>
								</EffectChoice>
							))}
						</ToolChoices>
					</ToolOption>
					{effect === "solid" ? (
						<ToolOption label="Color">
							<ColorOptions
								value={settings.color}
								customColor={customColor}
								onPick={(color) => color && onChange({ ...settings, color })}
								onPickCustom={onPickCustom}
								onEyedropper={onEyedropper}
							/>
						</ToolOption>
					) : (
						<ToolOption label="Strength">
							<ToolChoices>
								{STRENGTH_NAMES[effect].map((name, index) => (
									<RingChoice
										key={name}
										label={name}
										selected={index === settings.strength}
										onPress={() => onChange({ ...settings, strength: index })}
									>
										{effect === "blur" ? (
											<StrengthDot strength={index} />
										) : (
											<PixelSquare strength={index} />
										)}
									</RingChoice>
								))}
							</ToolChoices>
						</ToolOption>
					)}
				</>
			)}
			{tool !== "box" && (
				<ToolOption label="Size">
					<SizeChoices
						index={brush ? settings.brushSize : settings.eraserSize}
						color={brush ? colors.textPrimary : null}
						onPick={pickSize}
					/>
				</ToolOption>
			)}
		</ToolOptions>
	);
}

/** An effect icon and its visible name, compact enough to leave the tray room. */
function EffectChoice({
	label,
	selected,
	onPress,
	children,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected }}
			style={styles.effectChoice}
		>
			{selected && <Highlight />}
			{children}
			<Text
				style={[styles.effectLabel, selected && styles.effectLabelSelected]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * A solid effect's color as a tile, or blur's or pixelation's mark, drawn in
 * `color`.
 */
export function EffectGlyph({
	settings,
	effect,
	color = colors.textPrimary,
}: {
	settings: RedactSettings;
	effect: RedactSettings["effect"];
	color?: string;
}) {
	if (effect !== "solid") {
		return (
			<MaterialCommunityIcons
				name={effect === "blur" ? "blur" : "checkerboard"}
				size={24}
				color={color}
			/>
		);
	}
	return (
		<View style={[styles.solidTile, { backgroundColor: settings.color }]} />
	);
}

const styles = StyleSheet.create({
	find: {
		height: 44,
		flexDirection: "row",
		flexShrink: 0,
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		borderRadius: radii.small,
	},
	findHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	findPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	findLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	solidTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
	effectChoice: {
		width: 56,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		gap: 3,
		borderRadius: radii.small,
	},
	effectLabel: {
		...typography.caption,
		color: colors.textPrimary,
	},
	effectLabelSelected: {
		color: colors.onHighlight,
	},
});
