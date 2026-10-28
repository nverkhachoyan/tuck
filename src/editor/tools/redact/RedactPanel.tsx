import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { colors } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { BarGroup, BarSections, OptionSegments } from "../../shell/ContextBar";
import {
	EffectGlyph,
	RedactLookOptions,
	redactLookItems,
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

/**
 * The redact tools, in place of the toolbar while redacting: a box to drag
 * out, a brush, the brush's eraser, and their style, which opens over the
 * canvas. The same order as the wide bar. Tapping the tool that's in use
 * opens the style too.
 */
export function RedactPanel({
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
 * Redact's options in the wide editor's header: Box, Brush, and Eraser, then
 * the effect and, for a solid one, its color, and a size for the brush and
 * eraser. Choosing the sub-tool already in use leaves it, since the options
 * stay in view.
 */
export function RedactBar({
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
