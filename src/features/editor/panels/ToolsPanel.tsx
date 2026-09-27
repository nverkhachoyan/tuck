import { TOOL_KEYS } from "../shortcuts";
import { ToolButton, ToolRow } from "../ToolButton";

/**
 * The editing tools, in the dock while no layer is selected. On web, each
 * shows the letter that picks it up (see `TOOL_KEYS`) on hover. Add opens
 * the sheet of photos and stickers, and spins while one is on its way.
 * Adjust shows only with an image to adjust.
 */
export function ToolsPanel({
	addBusy,
	onAddText,
	onDraw,
	onRedact,
	onAdd,
	onCrop,
	onAdjust,
}: {
	addBusy: boolean;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onAdd: () => void;
	onCrop: () => void;
	onAdjust?: () => void;
}) {
	return (
		<ToolRow>
			<ToolButton
				label="Text"
				icon="format-text"
				shortcut={TOOL_KEYS.text}
				onPress={onAddText}
			/>
			<ToolButton
				label="Draw"
				icon="draw"
				shortcut={TOOL_KEYS.draw}
				onPress={onDraw}
			/>
			<ToolButton
				label="Redact"
				icon="blur"
				shortcut={TOOL_KEYS.redact}
				onPress={onRedact}
			/>
			<ToolButton
				label="Add"
				icon="plus-circle-outline"
				shortcut={TOOL_KEYS.add}
				busy={addBusy}
				onPress={onAdd}
			/>
			<ToolButton
				label="Crop"
				icon="crop-rotate"
				shortcut={TOOL_KEYS.crop}
				onPress={onCrop}
			/>
			{onAdjust && (
				<ToolButton
					label="Adjust"
					icon="tune-variant"
					shortcut={TOOL_KEYS.adjust}
					onPress={onAdjust}
				/>
			)}
		</ToolRow>
	);
}
