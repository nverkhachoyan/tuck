import { ToolButton, ToolRow } from "../ToolButton";

/**
 * Actions for the selected photo, drawing, shape, or redaction, in place of
 * the tools, as the text panel is for text: it's moved and sized on the
 * canvas, and tapping the canvas off it deselects it. `onDraw` goes on
 * drawing on a drawing or restyles a shape, `onRedact` restyles a
 * redaction or paints on, and `onAdjust` changes an image's colors. `onSaveSticker` keeps a photo as a sticker; once
 * it has, `sticker` is "saved", and the button says so.
 */
export function LayerActionsPanel({
	canMoveForward,
	canMoveBackward,
	onDraw,
	onRedact,
	onAdjust,
	resizeEnabled,
	onToggleResize,
	sticker,
	onSaveSticker,
	onMoveForward,
	onMoveBackward,
	onDuplicate,
	onDelete,
}: {
	canMoveForward: boolean;
	canMoveBackward: boolean;
	onDraw?: () => void;
	onRedact?: () => void;
	onAdjust?: () => void;
	resizeEnabled?: boolean;
	onToggleResize?: () => void;
	sticker?: "saving" | "saved";
	onSaveSticker?: () => void;
	onMoveForward: () => void;
	onMoveBackward: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}) {
	return (
		<ToolRow>
			{onDraw && <ToolButton label="Draw" icon="draw" onPress={onDraw} />}
			{onRedact && <ToolButton label="Redact" icon="blur" onPress={onRedact} />}
			{onAdjust && (
				<ToolButton label="Adjust" icon="tune-variant" onPress={onAdjust} />
			)}
			{onToggleResize && (
				<ToolButton
					label="Stretch"
					icon="arrow-expand"
					selected={resizeEnabled}
					onPress={onToggleResize}
				/>
			)}
			{onSaveSticker && (
				<ToolButton
					label={sticker === "saved" ? "Saved" : "Sticker"}
					icon={
						sticker === "saved"
							? "sticker-check-outline"
							: "sticker-plus-outline"
					}
					busy={sticker === "saving"}
					disabled={sticker === "saved"}
					onPress={onSaveSticker}
				/>
			)}
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
