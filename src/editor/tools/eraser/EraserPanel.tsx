import { BarGroup, BarSections, OptionSegments } from "../../shell/ContextBar";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import { SizeChip, SizeChoices } from "../../shell/ToolOptions";
import type { ToolIcon } from "../../shell/toolList";
import type { EraserMode } from "./eraserSettings";
import type { EraserController } from "./useEraserTool";

export type EraserModeMeta = {
	mode: EraserMode;
	title: string;
	icon: ToolIcon;
};

export const ERASER_MODES: readonly EraserModeMeta[] = [
	{ mode: "eraser", title: "Eraser", icon: "eraser" },
	{ mode: "stroke", title: "Stroke eraser", icon: "gesture" },
];

export const eraserModeOf = (mode: EraserMode): EraserModeMeta =>
	ERASER_MODES.find((item) => item.mode === mode) ?? ERASER_MODES[0];

/**
 * Eraser options in the wide editor's header bar:
 * - Eraser or Stroke eraser, as segments
 * - Size selector chip, for the Eraser only
 */
export function EraserBar({
	controller: { settings, change, setMode },
}: {
	controller: EraserController;
}) {
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Eraser"
					options={ERASER_MODES.map(({ title, icon }) => ({ title, icon }))}
					selected={ERASER_MODES.findIndex(
						(item) => item.mode === settings.mode,
					)}
					onSelect={(index) => {
						const next = ERASER_MODES[index]?.mode;
						if (next) setMode(next);
					}}
				/>
				{settings.mode === "eraser" && (
					<SizeChip
						index={settings.sizeIndex}
						color={null}
						onPick={(sizeIndex) => change({ ...settings, sizeIndex })}
					/>
				)}
			</BarGroup>
		</BarSections>
	);
}

/**
 * Dock buttons on phone:
 * - Eraser and Stroke eraser
 * - The Eraser's size choices beside them (no nested levels)
 */
export function EraserPanel({
	controller: { settings, change, setMode },
}: {
	controller: EraserController;
}) {
	return (
		<ToolRow>
			{ERASER_MODES.map(({ mode, title, icon }) => (
				<ToolButton
					key={mode}
					label={title}
					icon={icon}
					selected={settings.mode === mode}
					onPress={() => setMode(mode)}
				/>
			))}
			{settings.mode === "eraser" && (
				<SizeChoices
					index={settings.sizeIndex}
					color={null}
					nowrap
					onPick={(sizeIndex) => change({ ...settings, sizeIndex })}
				/>
			)}
		</ToolRow>
	);
}
