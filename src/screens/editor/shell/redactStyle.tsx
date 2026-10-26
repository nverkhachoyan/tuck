import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors, space } from "@/ui/theme";
import { ColorChip } from "./ColorPicker";
import { BarChip, OptionSegments } from "./ContextBar";
import { ToolChoices } from "./ToolOptions";

// The part of a redaction's settings the bars show. Declared here so shell
// doesn't import the redact tool: both Redact and Find hand their settings over.
export type RedactLookSettings = {
	effect: "solid" | "blur" | "pixelate";
	color: string;
	strength: number;
};

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

export type RedactLookProps<T extends RedactLookSettings> = {
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
export function redactLookItems<T extends RedactLookSettings>({
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
 * Blur's or pixelation's strengths, ringed when chosen, in Redact's tray and
 * in the effect chip's popover. `nowrap` keeps them on one line.
 */
export function StrengthChoices({
	effect,
	strength,
	nowrap = false,
	onPick,
}: {
	effect: Exclude<RedactLookSettings["effect"], "solid">;
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

const styles = StyleSheet.create({
	effectChoices: {
		gap: space.sm,
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
