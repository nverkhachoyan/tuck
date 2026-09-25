import { ToolButton, ToolRow } from "../ToolButton";

/**
 * Actions for the selected photo, drawing, or redaction, in place of the
 * tools, as the text panel is for text: it's moved and sized on the canvas,
 * and tapping the canvas off it deselects it. `onDraw` goes on drawing on
 * a drawing, and `onRedact` restyles a redaction or paints on.
 */
export function LayerActionsPanel({
	canMoveForward,
	canMoveBackward,
	onDraw,
	onRedact,
	onMoveForward,
	onMoveBackward,
	onDuplicate,
	onDelete,
}: {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onDraw?: () => void;
	onRedact?: () => void;
	onMoveForward: () => void;
	onMoveBackward: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	return (
		<ToolRow>
			{onDraw && <ToolButton label="Draw" icon="draw" onPress={onDraw} />}
			{onRedact && <ToolButton label="Redact" icon="blur" onPress={onRedact} />}
			<ToolButton
				label="Forward"
				icon="arrange-bring-forward"
				shortcut="mod+]"
				disabled={!canMoveForward}
				onPress={onMoveForward}
			/>
			<ToolButton
				label="Backward"
				icon="arrange-send-backward"
				shortcut="mod+["
				disabled={!canMoveBackward}
				onPress={onMoveBackward}
			/>
			<ToolButton
				label="Duplicate"
				icon="content-copy"
				shortcut="mod+D"
				onPress={onDuplicate}
			/>
			<ToolButton
				label="Delete"
				icon="trash-can-outline"
				shortcut="Delete"
				tone="danger"
				onPress={onDelete}
			/>
		</ToolRow>
	);
}
