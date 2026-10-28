import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Highlight } from "@/ui/Highlight";
import { chosenOnWeb } from "@/ui/interaction";
import { RingChoice } from "@/ui/RingChoice";
import { colors, radii, space, typography } from "@/ui/theme";
import { ColorChip, ColorOptions } from "./ColorOptions";
import { BarChip, OptionSegments } from "./ContextBar";
import type { RedactLook } from "./redactLook";
import { ToolChoices, ToolOption } from "./ToolOptions";

// The redaction effects, in the order the bars and Redact's tray list them:
// each one's name and the bar's icon for it.
export const EFFECTS = [
	{ title: "Solid", effect: "solid", icon: "format-color-fill" },
	{ title: "Blur", effect: "blur", icon: "blur" },
	{ title: "Pixelate", effect: "pixelate", icon: "checkerboard" },
] as const;

const STRENGTH_NAMES = {
	blur: ["Light blur", "Medium blur", "Strong blur"],
	pixelate: ["Small pixels", "Medium pixels", "Large pixels"],
} as const;

export type RedactLookProps<T extends RedactLook> = {
	settings: T;
	customColor: string | null;
	onChange: (settings: T) => void;
	onPickCustom: (color: string) => void;
	onEyedropper: () => void;
};

/**
 * The effect's controls, one each, so a bar group can measure them apart:
 * a chip for Solid, Blur, or Pixelate, then the color when the effect is
 * solid. The chip's popover holds the effect's strength, never the color.
 */
export function redactLookItems<T extends RedactLook>({
	settings,
	customColor,
	onChange,
	onPickCustom,
	onEyedropper,
}: RedactLookProps<T>): ReactNode[] {
	const { effect } = settings;
	const selected = EFFECTS.findIndex((choice) => choice.effect === effect);
	const current = EFFECTS[selected] ?? EFFECTS[0];
	return [
		<BarChip
			key="effect"
			label={current.title}
			icon={current.icon}
			text={current.title}
		>
			{(close) => (
				<View style={styles.effectChoices}>
					<OptionSegments
						label="Effect"
						options={EFFECTS.map(({ title, icon }) => ({ title, icon }))}
						selected={selected}
						onSelect={(index) => {
							const next = EFFECTS[index]?.effect;
							if (next && next !== effect) {
								onChange({ ...settings, effect: next });
							}
							// Blur and pixelate show their strengths here next.
							if (next === "solid") close();
						}}
					/>
					{effect !== "solid" && (
						<StrengthChoices
							nowrap
							effect={effect}
							strength={settings.strength}
							onPick={(strength) => {
								onChange({ ...settings, strength });
								close();
							}}
						/>
					)}
				</View>
			)}
		</BarChip>,
		...(effect === "solid"
			? [
					<ColorChip
						key="color"
						label="Color"
						value={settings.color}
						customColor={customColor}
						onPick={(color) => color && onChange({ ...settings, color })}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>,
				]
			: []),
	];
}

/**
 * How the redaction looks, as rows of a tray (see `ToolOptions`): the
 * effect, then the color for Solid or the strength for Blur and Pixelate.
 */
export function RedactLookOptions<T extends RedactLook>({
	settings,
	customColor,
	onChange,
	onPickCustom,
	onEyedropper,
}: RedactLookProps<T>) {
	const { effect } = settings;
	return (
		<>
			<ToolOption label="Effect">
				<ToolChoices>
					{EFFECTS.map(({ effect: choice, title }) => (
						<EffectChoice
							key={choice}
							label={title}
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
					<StrengthChoices
						effect={effect}
						strength={settings.strength}
						onPick={(strength) => onChange({ ...settings, strength })}
					/>
				</ToolOption>
			)}
		</>
	);
}

/**
 * Blur's or pixelation's strengths, ringed when chosen, in Redact's tray and
 * in the effect chip's popover. `nowrap` keeps them on one line.
 */
export function StrengthChoices({
	effect,
	strength,
	nowrap = false,
	onPick,
}: {
	effect: Exclude<RedactLook["effect"], "solid">;
	strength: number;
	nowrap?: boolean;
	onPick: (strength: number) => void;
}) {
	return (
		<ToolChoices nowrap={nowrap}>
			{STRENGTH_NAMES[effect].map((name, index) => (
				<RingChoice
					key={name}
					label={name}
					selected={index === strength}
					onPress={() => onPick(index)}
				>
					{effect === "blur" ? (
						<StrengthDot strength={index} />
					) : (
						<PixelSquare strength={index} />
					)}
				</RingChoice>
			))}
		</ToolChoices>
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

/**
 * A solid effect's color as a tile, or blur's or pixelation's mark, drawn in
 * `color`.
 */
export function EffectGlyph({
	settings,
	effect,
	color = colors.textPrimary,
}: {
	settings: RedactLook;
	effect: RedactLook["effect"];
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
			{...chosenOnWeb(selected)}
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

const styles = StyleSheet.create({
	solidTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
	effectChoices: {
		gap: space.sm,
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
	halo: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.borderStrong,
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
		backgroundColor: colors.borderStrong,
	},
	pixelLit: {
		backgroundColor: colors.textPrimary,
	},
});
