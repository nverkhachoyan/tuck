import { ToolButton, ToolRow } from "../ToolButton";

/** The editing tools, in the dock while no layer is selected. */
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
			<ToolButton label="Text" icon="format-text" onPress={onAddText} />
			<ToolButton label="Draw" icon="draw" onPress={onDraw} />
			<ToolButton label="Redact" icon="blur" onPress={onRedact} />
			<ToolButton
				label="Photo"
				icon="image-plus"
				busy={photoBusy}
				onPress={onAddPhoto}
			/>
			<ToolButton label="Crop" icon="crop-rotate" onPress={onCrop} />
		</ToolRow>
	);
}
