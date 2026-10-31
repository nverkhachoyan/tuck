import { BarGroup, BarSections } from "../../shell/ContextBar";
import { ToolRow } from "../../shell/ToolButton";
import { SizeChip, SizeChoices } from "../../shell/ToolOptions";
import type { EraserController } from "./useEraserTool";

/**
 * Eraser options in the wide editor's header bar:
 * - Size selector chip
 */
export function EraserBar({
	controller: { settings, change },
}: {
	controller: EraserController;
}) {
	return (
		<BarSections>
			<BarGroup>
				<SizeChip
					index={settings.sizeIndex}
					color={null}
					onPick={(sizeIndex) => change({ sizeIndex })}
				/>
			</BarGroup>
		</BarSections>
	);
}

/**
 * Dock buttons on phone:
 * - Direct size choices row (no nested levels)
 */
export function EraserPanel({
	controller: { settings, change },
}: {
	controller: EraserController;
}) {
	return (
		<ToolRow>
			<SizeChoices
				index={settings.sizeIndex}
				color={null}
				nowrap
				onPick={(sizeIndex) => change({ sizeIndex })}
			/>
		</ToolRow>
	);
}
