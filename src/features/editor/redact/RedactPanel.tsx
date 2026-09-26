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
import type { RedactSettings, RedactTool } from "./redactSettings";

const STRENGTH_NAMES = {
	blur: ["Light blur", "Medium blur", "Strong blur"],
	pixelate: ["Small pixels", "Medium pixels", "Large pixels"],
};

/**
 * The redact tools, in place of the toolbar while redacting: a box to drag
 * out, a brush, its eraser, and their style, which opens over the canvas.
 * Tapping the tool that's in use opens the style too.
 */
export function RedactPanel({
	settings,
	optionsOpen,
	onChange,
	onToggleOptions,
}: {
	settings: RedactSettings;
	optionsOpen: boolean;
	onChange: (settings: RedactSettings) => void;
	onToggleOptions: () => void;
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
				selected={optionsOpen}
				onPress={onToggleOptions}
			/>
		</ToolRow>
	);
}

/**
 * How the redaction looks, and the brush's size, in a card over the canvas
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
		>
			{tool !== "eraser" && (
				<>
					<ToolOption label="Effect">
						<ToolChoices>
							<RingChoice
								label="Solid"
								selected={effect === "solid"}
								onPress={() => onChange({ ...settings, effect: "solid" })}
							>
								<EffectGlyph settings={settings} effect="solid" />
							</RingChoice>
							<RingChoice
								label="Blur"
								selected={effect === "blur"}
								onPress={() => onChange({ ...settings, effect: "blur" })}
							>
								<EffectGlyph settings={settings} effect="blur" />
							</RingChoice>
							<RingChoice
								label="Pixelate"
								selected={effect === "pixelate"}
								onPress={() => onChange({ ...settings, effect: "pixelate" })}
							>
								<EffectGlyph settings={settings} effect="pixelate" />
							</RingChoice>
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
					<ToolChoices>
						{SIZE_DOTS.map((dot, index) => (
							<RingChoice
								key={dot}
								label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
								selected={
									index === (brush ? settings.brushSize : settings.eraserSize)
								}
								onPress={() => pickSize(index)}
							>
								<SizeDot size={dot} color={brush ? colors.textPrimary : null} />
							</RingChoice>
						))}
					</ToolChoices>
				</ToolOption>
			)}
		</ToolOptions>
	);
}

/** A solid effect's color as a tile, or blur's or pixelation's mark. */
function EffectGlyph({
	settings,
	effect,
}: {
	settings: RedactSettings;
	effect: RedactSettings["effect"];
}) {
	if (effect !== "solid") {
		return (
			<MaterialCommunityIcons
				name={effect === "blur" ? "blur" : "checkerboard"}
				size={24}
				color={colors.textPrimary}
			/>
		);
	}
	return (
		<View style={[styles.solidTile, { backgroundColor: settings.color }]} />
	);
}

/** A dot whose halo spreads further the stronger the blur. */
function StrengthDot({ strength }: { strength: number }) {
	const size = 14 + strength * 7;
	return (
		<View
			style={[
				styles.halo,
				{ width: size, height: size, borderRadius: size / 2 },
			]}
		>
			<View style={styles.core} />
		</View>
	);
}

/** Four pixels, larger the larger the pixelation's. */
function PixelSquare({ strength }: { strength: number }) {
	const size = 14 + strength * 6;
	return (
		<View style={[styles.pixels, { width: size, height: size }]}>
			<View style={[styles.pixel, styles.pixelLit]} />
			<View style={styles.pixel} />
			<View style={styles.pixel} />
			<View style={[styles.pixel, styles.pixelLit]} />
		</View>
	);
}

const styles = StyleSheet.create({
	solidTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	halo: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(245, 245, 247, 0.28)",
	},
	core: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.textPrimary,
	},
	pixels: {
		flexDirection: "row",
		flexWrap: "wrap",
		borderRadius: 3,
		overflow: "hidden",
	},
	pixel: {
		width: "50%",
		height: "50%",
		backgroundColor: "rgba(245, 245, 247, 0.28)",
	},
	pixelLit: {
		backgroundColor: colors.textPrimary,
	},
});
