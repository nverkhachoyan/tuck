import { TOOL_KEYS } from "../shortcuts";
import { ToolButton, ToolRow } from "../ToolButton";

/**
 * The editing tools, in the dock while no layer is selected. On web, each
 * shows the letter that picks it up (see `TOOL_KEYS`) on hover.
 */
export function ToolsPanel({
	photoBusy,
	onAddText,
	onDraw,
	onRedact,
	onAddPhoto,
	onCrop,
}: {
	photoBusy: boolean;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onAddPhoto: () => void;
	onCrop: () => void;
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
				label="Photo"
				icon="image-plus"
				shortcut={TOOL_KEYS.photo}
				busy={photoBusy}
				onPress={onAddPhoto}
			/>
			<ToolButton
				label="Crop"
				icon="crop-rotate"
				shortcut={TOOL_KEYS.crop}
				onPress={onCrop}
			/>
		</ToolRow>
	);
}
