import type { DockPanel } from "./editorChrome";
import { InspectorContent, type PanelContext } from "./PanelViews";
import { Inspector } from "./shell/Dock";
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
	context: PanelContext;
	panel: DockPanel;
	layerList: ReturnType<typeof layerListProps>;
}) {
	const layers = <LayersPanel {...layerList} layout="inspector" open />;
	return (
		<Inspector>
			<InspectorContent context={context} panel={panel} layers={layers} />
		</Inspector>
	);
}
