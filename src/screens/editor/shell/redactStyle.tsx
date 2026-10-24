import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { ColorChip } from "./ColorPicker";
import { OptionSegments } from "./ContextBar";

// The part of a redaction's settings the bars show. Declared here so shell
// doesn't import the redact tool: both Redact and Find hand their settings over.
type RedactLookSettings = {
	effect: "solid" | "blur" | "pixelate";
	color: string;
	strength: number;
};

const EFFECTS = [
	{ title: "Solid", effect: "solid" },
	{ title: "Blur", effect: "blur" },
	{ title: "Pixelate", effect: "pixelate" },
] as const;

export const STRENGTH_NAMES = {
	blur: ["Light blur", "Medium blur", "Strong blur"],
	pixelate: ["Small pixels", "Medium pixels", "Large pixels"],
} as const;

/**
 * The effect a redaction is drawn with: Solid, Blur, or Pixelate, then that
 * effect's color or its strength. Redact's bar shows it, and so does Find's,
 * for the style Done redacts what it found with.
 */
export function RedactLook<T extends RedactLookSettings>({
	settings,
	customColor,
	onChange,
	onPickCustom,
	onEyedropper,
}: {
	settings: T;
	customColor: string | null;
	onChange: (settings: T) => void;
	onPickCustom: (color: string) => void;
	onEyedropper: () => void;
}) {
	const { effect } = settings;
	const selected = EFFECTS.findIndex((choice) => choice.effect === effect);
	return (
		<>
			<OptionSegments
				label="Effect"
				options={EFFECTS.map(({ title }) => ({ title }))}
				selected={selected}
				onSelect={(index) => {
					const next = EFFECTS[index]?.effect;
					if (!next || next === effect) return;
					onChange({ ...settings, effect: next });
				}}
			/>
			{effect === "solid" ? (
				<ColorChip
					label="Color"
					value={settings.color}
					customColor={customColor}
					onPick={(color) => color && onChange({ ...settings, color })}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			) : (
				STRENGTH_NAMES[effect].map((name, index) => (
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
				))
			)}
		</>
	);
}

/** A dot whose halo spreads further the stronger the blur. */
export function StrengthDot({ strength }: { strength: number }) {
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
export function PixelSquare({ strength }: { strength: number }) {
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
