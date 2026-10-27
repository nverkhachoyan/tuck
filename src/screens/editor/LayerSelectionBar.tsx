import type { EditorDocument } from "@/model/document";
import type { Layer } from "@/model/layers/layer";
import { useStore } from "@/store";
import { type ArrangeMove, SelectionBar } from "./shell/SelectionBar";

/**
 * Moving the selected layer in the stack (`arrange`), and where it stands:
 * at `index`, under the top layer at `topIndex`.
 */
export function useArrangeSelected(
	document: EditorDocument,
	selectedLayer: Layer | undefined,
) {
	const { moveLayer } = useStore((state) => state.actions);
	const index = selectedLayer ? document.layers.indexOf(selectedLayer) : -1;
	const topIndex = document.layers.length - 1;
	const arrange = (move: ArrangeMove) => {
		if (!selectedLayer) return;
		const to = {
			front: topIndex,
			forward: index + 1,
			backward: index - 1,
			back: 0,
		};
		moveLayer(selectedLayer.id, to[move]);
	};
	return { index, topIndex, arrange };
}

/**
 * The selection bar for `layer`, at `index` in the stack: Edit for text and
 * Free resize for text and images.
 */
export function LayerSelectionBar({
	layer,
	index,
	topIndex,
	onEdit,
	onSetResizable,
	onArrange,
	onDuplicate,
	onDelete,
}: {
	layer: Layer;
	index: number;
	topIndex: number;
	onEdit: () => void;
	onSetResizable: (id: string, resizable: boolean) => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: (id: string) => void;
}) {
	const resizable = layer.type === "text" || layer.type === "image";
	return (
		<SelectionBar
			canMoveForward={index < topIndex}
			canMoveBackward={index > 0}
			onEdit={layer.type === "text" ? onEdit : undefined}
			stretched={layer.resizable === true}
			onToggleStretch={
				resizable ? () => onSetResizable(layer.id, !layer.resizable) : undefined
			}
			onArrange={onArrange}
			onDuplicate={onDuplicate}
			onDelete={() => onDelete(layer.id)}
		/>
	);
}
