import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { ColorChip, ColorOptions } from "../../shell/ColorOptions";
import {
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChip,
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import {
	type PenTipChoice,
	penColor,
	withPenColor,
	withPenSize,
} from "./penSettings";
import type { PenController } from "./usePenTool";

export type PenTipMeta = {
	tip: PenTipChoice;
	title: string;
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

export const TIPS: readonly PenTipMeta[] = [
	{ tip: "pen", title: "Pen", icon: "draw-pen" },
	{ tip: "marker", title: "Highlighter", icon: "marker" },
	{ tip: "ink", title: "Marker", icon: "brush" },
	{ tip: "neon", title: "Neon", icon: "shimmer" },
] as const;

export const metaOf = (tip: PenTipChoice): PenTipMeta =>
	TIPS.find((item) => item.tip === tip) ?? TIPS[0];

/**
 * Pen options in the wide editor's header bar:
 * - Tip selector popover (Pen, Highlighter, Marker, Neon)
 * - Color swatch popover with custom color and eyedropper
 * - Stroke size selector
 */
export function PenBar({
	controller: { settings, change },
}: {
	controller: PenController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withPenColor(settings, color)),
	);
	const tip = metaOf(settings.tip);
	const color = penColor(settings);

	return (
		<BarSections>
			<BarGroup>
				<BarChip label={tip.title} icon={tip.icon} text={tip.title}>
					{(close) => (
						<OptionSegments
							label="Pen tip"
							options={TIPS.map(({ title, icon }) => ({ title, icon }))}
							selected={TIPS.findIndex((item) => item.tip === settings.tip)}
							onSelect={(index) => {
								const next = TIPS[index]?.tip;
								if (next && next !== settings.tip) {
									change({ ...settings, tip: next });
								}
								close();
							}}
						/>
					)}
				</BarChip>
				<ColorChip
					label="Color"
					value={color}
					customColor={customColor}
					onPick={(c) => c && change(withPenColor(settings, c))}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
				<SizeChip
					index={settings.sizes[settings.tip]}
					color={color}
					tip={settings.tip === "pen" ? undefined : settings.tip}
					onPick={(size) => change(withPenSize(settings, size))}
				/>
			</BarGroup>
		</BarSections>
	);
}

/**
 * Dock buttons on phone:
 * - 4 tips: 1-tap toggling between Pen, Highlighter, Marker, Neon.
 * - Style button showing current swatch, opening shared tray.
 */
export function PenPanel({
	controller: { settings, change },
}: {
	controller: PenController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();

	const selectTip = (tip: PenTipChoice) => {
		if (settings.tip === tip) {
			toggleTray();
		} else {
			change({ ...settings, tip });
		}
	};

	return (
		<ToolRow>
			{TIPS.map(({ tip, title, icon }) => (
				<ToolButton
					key={tip}
					label={title}
					icon={icon}
					selected={settings.tip === tip}
					onPress={() => selectTip(tip)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<ColorGlyph color={penColor(settings)} />}
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

/**
 * Tray rising above the phone dock with tip, color, and size options.
 */
export function PenTray({
	controller: { settings, change },
}: {
	controller: PenController;
}) {
	const { bottomInset, closeTray } = useEditorContext();
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withPenColor(settings, color)),
	);
	const color = penColor(settings);

	return (
		<ToolOptions
			closeLabel="Close pen options"
			bottomInset={bottomInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			<ToolOption label="Tip">
				<ToolChoices>
					{TIPS.map(({ tip, title, icon }) => (
						<RingChoice
							key={tip}
							variant="highlight"
							label={title}
							selected={settings.tip === tip}
							onPress={() => change({ ...settings, tip })}
						>
							{(ink) => (
								<MaterialCommunityIcons name={icon} size={22} color={ink} />
							)}
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
			<ToolOption label="Color">
				<ColorOptions
					value={color}
					customColor={customColor}
					onPick={(c) => c && change(withPenColor(settings, c))}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			</ToolOption>
			<ToolOption label="Size">
				<SizeChoices
					index={settings.sizes[settings.tip]}
					color={color}
					tip={settings.tip === "pen" ? undefined : settings.tip}
					onPick={(size) => change(withPenSize(settings, size))}
				/>
			</ToolOption>
		</ToolOptions>
	);
}

function ColorGlyph({ color }: { color: string }) {
	return <View style={[styles.colorTile, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
	colorTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
});
