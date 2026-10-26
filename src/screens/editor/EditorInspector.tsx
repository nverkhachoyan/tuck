import type { ToolViewContext } from "./EditorDock";
import type { DockPanel } from "./editorChrome";
import { Inspector } from "./shell/Dock";
import { AdjustInspector } from "./tools/adjust/AdjustPanel";
import { FindInspector } from "./tools/find/FindPanel";
import { LayersPanel, type layerListProps } from "./tools/layers/LayersPanel";

/**
 * What the wide editor shows on the right when the window is tall enough, or
 * when Layers, Find, or Adjust has it open: the layers list, with Find or
 * Adjust above it.
 */
export function EditorInspector({
	context,
	panel,
	layerList,
}: {
	context: ToolViewContext;
	panel: DockPanel;
	layerList: ReturnType<typeof layerListProps>;
}) {
	const {
		tools: { find, adjust },
		adjustments,
		onBackToRedact,
	} = context;
	const layers = <LayersPanel {...layerList} layout="inspector" open />;
	return (
		<Inspector>
			{panel === "find" ? (
				<FindInspector
					state={find.state}
					visibleIndices={find.visibleIndices}
					selectedCount={find.selectedCount}
					review={find.review}
					onFind={find.find}
					onRetry={find.retry}
					onBack={onBackToRedact}
					onStop={find.reset}
					onSelectAll={find.selectAll}
					onClear={find.clear}
				>
					{layers}
				</FindInspector>
			) : panel === "adjust" ? (
				<AdjustInspector controller={adjust} adjustments={adjustments}>
					{layers}
				</AdjustInspector>
			) : (
				layers
			)}
		</Inspector>
	);
}
