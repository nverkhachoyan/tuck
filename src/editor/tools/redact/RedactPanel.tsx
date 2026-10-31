import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { colors, space } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { ColorChip } from "../../shell/ColorOptions";
import { ColorSwatches, customSwatch } from "../../shell/ColorSwatches";
import { BarGroup, BarSections, OptionSegments } from "../../shell/ContextBar";
import {
	EFFECTS,
	EffectGlyph,
	RedactLookOptions,
	redactLookItems,
	StrengthChoices,
} from "../../shell/redactStyle";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChip,
	SizeChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import {
	type RedactTool,
	redactSizeIndex,
	withRedactSize,
} from "./redactSettings";
import type { RedactController } from "./useRedactTool";

// Redact's sub-tools, in the order the dock and the bar show them.
const REDACT_TOOLS = [
	{ tool: "box", title: "Box", icon: "rectangle-outline" },
	{ tool: "brush", title: "Brush", icon: "brush" },
	{ tool: "eraser", title: "Eraser", icon: "eraser" },
] as const satisfies readonly {
	tool: RedactTool;
	title: string;
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}[];

function RedactStyleDock({
	controller: { settings, change },
}: {
	controller: RedactController;
}) {
	const { customColor, onPickCustom } = useColorTarget((color) =>
		change({ ...settings, color }),
	);
	const { effect } = settings;
	const selectedEffect = EFFECTS.findIndex((e) => e.effect === effect);
	return (
		<View style={styles.dockColumn}>
			<View style={styles.dockRow1}>
				<OptionSegments
					label="Effect"
					options={EFFECTS.map(({ title, icon }) => ({ title, icon }))}
					selected={selectedEffect}
					onSelect={(index) => {
						const next = EFFECTS[index]?.effect;
						if (next && next !== effect) change({ ...settings, effect: next });
					}}
				/>
			</View>
			<View style={styles.dockRow2}>
				{effect === "solid" ? (
					<ColorSwatches
						value={settings.color}
						custom={customSwatch(
							settings.color,
							customColor,
							(c) => change({ ...settings, color: c }),
							() => onPickCustom(settings.color),
						)}
						onPick={(c) => c && change({ ...settings, color: c })}
					/>
				) : (
					<StrengthChoices
						nowrap
						effect={effect}
						strength={settings.strength}
						onPick={(strength) => change({ ...settings, strength })}
					/>
				)}
			</View>
		</View>
	);
}

function RedactStyleBar({
	controller: { settings, change },
}: {
	controller: RedactController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);
	const { effect } = settings;
	const selectedEffect = EFFECTS.findIndex((e) => e.effect === effect);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Effect"
					options={EFFECTS.map(({ title, icon }) => ({ title, icon }))}
					selected={selectedEffect}
					onSelect={(index) => {
						const next = EFFECTS[index]?.effect;
						if (next && next !== effect) change({ ...settings, effect: next });
					}}
				/>
			</BarGroup>
			<BarGroup>
				{effect === "solid" ? (
					<ColorChip
						label="Color"
						value={settings.color}
						customColor={customColor}
						onPick={(c) => c && change({ ...settings, color: c })}
						onPickCustom={onPickCustom}
						onEyedropper={onEyedropper}
					/>
				) : (
					<StrengthChoices
						nowrap
						effect={effect}
						strength={settings.strength}
						onPick={(strength) => change({ ...settings, strength })}
					/>
				)}
			</BarGroup>
		</BarSections>
	);
}

function ActiveRedactPanel({
	controller: { settings, change },
}: {
	controller: RedactController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();
	const pickTool = (tool: RedactTool) => {
		if (tool === settings.tool) toggleTray();
		else change({ ...settings, tool });
	};
	return (
		<ToolRow>
			{REDACT_TOOLS.map(({ tool, title, icon }) => (
				<ToolButton
					key={tool}
					label={title}
					icon={icon}
					selected={settings.tool === tool}
					onPress={() => pickTool(tool)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<EffectGlyph settings={settings} effect={settings.effect} />}
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

/**
 * The redact tools, in place of the toolbar while redacting: a box to drag
 * out, a brush, the brush's eraser, and their style, which opens over the
 * canvas. When a redaction is selected, directly shows effect and look choices.
 */
export function RedactPanel({ controller }: { controller: RedactController }) {
	return controller.isStylingSelected ? (
		<RedactStyleDock controller={controller} />
	) : (
		<ActiveRedactPanel controller={controller} />
	);
}

function ActiveRedactBar({
	controller: { settings, change },
}: {
	controller: RedactController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);
	const { tool } = settings;
	const selected = REDACT_TOOLS.findIndex((choice) => choice.tool === tool);
	const size = redactSizeIndex(settings);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Redact tool"
					options={REDACT_TOOLS}
					selected={selected}
					onSelect={(index) => {
						const next = REDACT_TOOLS[index]?.tool;
						if (!next || next === tool) return;
						change({ ...settings, tool: next });
					}}
				/>
			</BarGroup>
			<BarGroup>
				{tool !== "eraser" &&
					redactLookItems({
						settings,
						customColor,
						onChange: change,
						onPickCustom,
						onEyedropper,
					})}
				{size !== null && (
					<SizeChip
						index={size}
						color={tool === "brush" ? colors.textPrimary : null}
						onPick={(index) => change(withRedactSize(settings, index))}
					/>
				)}
			</BarGroup>
		</BarSections>
	);
}

/**
 * Redact's options in the wide editor's header bar.
 */
export function RedactBar({ controller }: { controller: RedactController }) {
	return controller.isStylingSelected ? (
		<RedactStyleBar controller={controller} />
	) : (
		<ActiveRedactBar controller={controller} />
	);
}

/**
 * How the redaction looks, and the brush's size, in a tray above the dock
 * (see `ToolOptions`). A box has no size, and an eraser no look.
 */
export function RedactOptions({
	controller: { settings, change },
}: {
	controller: RedactController;
}) {
	const { bottomInset, closeTray } = useEditorContext();
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);
	const { tool } = settings;
	const size = redactSizeIndex(settings);
	return (
		<ToolOptions
			closeLabel="Close redaction style"
			bottomInset={bottomInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			{tool !== "eraser" && (
				<RedactLookOptions
					settings={settings}
					customColor={customColor}
					onChange={change}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			)}
			{size !== null && (
				<ToolOption label="Size">
					<SizeChoices
						index={size}
						color={tool === "brush" ? colors.textPrimary : null}
						onPick={(index) => change(withRedactSize(settings, index))}
					/>
				</ToolOption>
			)}
		</ToolOptions>
	);
}

const styles = StyleSheet.create({
	dockColumn: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: space.xs,
	},
	dockRow1: {
		flexDirection: "row",
		alignItems: "center",
	},
	dockRow2: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
});
