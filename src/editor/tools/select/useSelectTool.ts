import type { CanvasInput } from "../../canvas/canvasInput";
import { useStore } from "../../store";
import type { ToolEnv } from "../defineTool";

const MARQUEE: CanvasInput = { type: "select", marquee: true };

export type SelectController = {
	count: number;
	canSelectAll: boolean;
	selectAll: () => void;
	canvasInput: CanvasInput;
};

/**
 * The Select tool's state: how many layers are selected, whether any can be
 * selected, and the marquee canvas input.
 */
export function useSelectTool({ document }: ToolEnv): SelectController {
	const count = useStore((state) => state.selectedLayerIds.length);
	const selectAll = useStore((state) => state.actions.selectAll);
	const canSelectAll = document.layers.some(
		(layer) => !layer.hidden && !layer.locked,
	);
	return {
		count,
		canSelectAll,
		selectAll,
		canvasInput: MARQUEE,
	};
}
