import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { colors } from "@/ui/theme";
import {
	BarButton,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
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
import { TOOL_KEYS } from "../../shortcuts";
import {
	type RedactSettings,
	type RedactTool,
	redactSizeIndex,
	withRedactSize,
} from "./redactSettings";

// Redact's sub-tools, in the order the dock and the bar show them, with
// Find after them.
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
 * out, a brush, the brush's eraser, Find (with a photo to look in, for faces
 * and text), and their style, which opens over the canvas. The same order as
 * the wide bar. Tapping the tool that's in use opens the style too.
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
			{REDACT_TOOLS.map(({ tool, title, icon }) => (
				<ToolButton
					key={tool}
					label={title}
					icon={icon}
					selected={settings.tool === tool}
					onPress={() => pickTool(tool)}
				/>
			))}
			{onFind && (
				<ToolButton
					label="Find"
					icon="image-search-outline"
					shortcut={TOOL_KEYS.find}
					onPress={onFind}
				/>
			)}
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

/**
 * Redact's options in the wide editor's header: Box, Brush, and Eraser, Find
 * when there's a photo to look in, then the effect and, for a solid one, its
 * color, and a size for the brush and eraser. Choosing the sub-tool already
 * in use leaves it, since the options stay in view.
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
						onChange({ ...settings, tool: next });
					}}
				/>
				{onFind && (
					<BarButton
						label="Find"
						icon="image-search-outline"
						shortcut={TOOL_KEYS.find}
						onPress={onFind}
					/>
				)}
			</BarGroup>
			<BarGroup>
				{tool !== "eraser" &&
					redactLookItems({
						settings,
						customColor,
						onChange,
						onPickCustom,
						onEyedropper,
					})}
				{size !== null && (
					<SizeChip
						index={size}
						color={tool === "brush" ? colors.textPrimary : null}
						onPick={(index) => onChange(withRedactSize(settings, index))}
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
	const { tool } = settings;
	const size = redactSizeIndex(settings);
	return (
		<ToolOptions
			closeLabel="Close redaction style"
			bottomInset={bottomInset}
			onClose={onClose}
			dismissOnOutsidePress={false}
		>
			{tool !== "eraser" && (
				<RedactLookOptions
					settings={settings}
					customColor={customColor}
					onChange={onChange}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			)}
			{size !== null && (
				<ToolOption label="Size">
					<SizeChoices
						index={size}
						color={tool === "brush" ? colors.textPrimary : null}
						onPick={(index) => onChange(withRedactSize(settings, index))}
					/>
				</ToolOption>
			)}
		</ToolOptions>
	);
}
