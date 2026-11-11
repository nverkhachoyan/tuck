import type { EditorDocument } from "../document/document";
import { drawingPieces } from "../layers/drawing/drawingEdits";
import type { Layer } from "../layers/layer";
import { useStore } from "../store";
import { type ArrangeMove, SelectionBar } from "./SelectionBar";

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
 * The selection bar for `layer`, at `index` in the stack: Edit for a layer
 * a tool edits in place (`onEdit`), Free resize for text and images, and
 * Separate for an unlocked drawing in more than one piece.
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
	onEdit?: () => void;
	onSetResizable: (id: string, resizable: boolean) => void;
	onArrange: (move: ArrangeMove) => void;
	onDuplicate: () => void;
	onDelete: (id: string) => void;
}) {
	const { separateSelectedDrawing } = useStore((state) => state.actions);
	const resizable =
		layer.type === "text" || (layer.type === "image" && !layer.sticker);
	const inPieces =
		layer.type === "drawing" &&
		!layer.locked &&
		drawingPieces(layer).length > 1;
	return (
		<SelectionBar
			canMoveForward={index < topIndex}
			canMoveBackward={index > 0}
			onEdit={onEdit}
			stretched={layer.resizable === true}
			onToggleStretch={
				resizable ? () => onSetResizable(layer.id, !layer.resizable) : undefined
			}
			onSeparate={inPieces ? separateSelectedDrawing : undefined}
			onArrange={onArrange}
			onDuplicate={onDuplicate}
			onDelete={() => onDelete(layer.id)}
		/>
	);
}
