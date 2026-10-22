import { ToolButton, ToolRow } from "../controls/ToolButton";
import { CutOutButton } from "./ToolsPanel";

/**
 * What only the selected photo, drawing, shape, or redaction can do, in
 * place of the tools, as the text panel is for text; the actions every
 * layer shares float by it (see `SelectionBar`). It's moved and sized on
 * the canvas, and tapping the canvas off it deselects it. `onDraw` goes on
 * drawing on a drawing or restyles a shape, `onRedact` restyles a
 * redaction or paints on, `onAdjust` changes an image's colors, and
 * `onFind` looks in an image for faces or text to redact, and `onCutOut`
 * cuts its subject out or refines its cut.
 * `onSaveSticker` keeps a photo as a sticker; once it has, `sticker` is
 * "saved", and the button says so.
 */
export function LayerActionsPanel({
	onDraw,
	onRedact,
	onAdjust,
	onFind,
	onCutOut,
	sticker,
	onSaveSticker,
}: {
	onDraw?: () => void;
	onRedact?: () => void;
	onAdjust?: () => void;
	onFind?: () => void;
	onCutOut?: () => void;
	sticker?: "saving" | "saved";
	onSaveSticker?: () => void;
}) {
	return (
		<ToolRow>
			{onDraw && <ToolButton label="Draw" icon="draw" onPress={onDraw} />}
			{onRedact && <ToolButton label="Redact" icon="blur" onPress={onRedact} />}
			{onAdjust && (
				<ToolButton label="Adjust" icon="tune-variant" onPress={onAdjust} />
			)}
			{onFind && (
				<ToolButton label="Find" icon="image-search-outline" onPress={onFind} />
			)}
			{onCutOut && <CutOutButton onPress={onCutOut} />}
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
		</ToolRow>
	);
}
