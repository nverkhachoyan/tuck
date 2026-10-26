import type { Adjustments } from "@/model/adjustments";
import type { DockPanel } from "./editorChrome";
import { Inspector } from "./shell/Dock";
import { AdjustInspector } from "./tools/adjust/AdjustPanel";
import { FindInspector } from "./tools/find/FindPanel";
import { LayersPanel, type layerListProps } from "./tools/layers/LayersPanel";
import type { EditorTools } from "./useToolLifecycle";

/**
 * What the wide editor shows on the right when the window is tall enough, or
 * when Layers, Find, or Adjust has it open: the layers list, with Find or
 * Adjust above it.
 */
export function EditorInspector({
	panel,
	find,
	adjust,
	adjustments,
	onFindBack,
	layerList,
}: {
	panel: DockPanel;
	find: EditorTools["find"];
	adjust: EditorTools["adjust"];
	adjustments: Adjustments | undefined;
	onFindBack: () => void;
	layerList: ReturnType<typeof layerListProps>;
}) {
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
					onBack={onFindBack}
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
