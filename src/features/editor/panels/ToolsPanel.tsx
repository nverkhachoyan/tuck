import { TOOL_KEYS } from "../shortcuts";
import { ToolButton, ToolRow } from "../ToolButton";

/** Whether the image Cut out acts on is cut out already, or being cut out. */
export type CutOutState = "whole" | "cutting" | "cut";

/**
 * Cuts the subject out of an image, spinning while it's found, or once it
 * has, brings the background back.
 */
export function CutOutButton({
	state,
	onPress,
}: {
	state: CutOutState;
	onPress: () => void;
}) {
	return (
		<ToolButton
			label={state === "cut" ? "Restore" : "Cut out"}
			icon={state === "cut" ? "image-refresh-outline" : "scissors-cutting"}
			shortcut={TOOL_KEYS.cutOut}
			busy={state === "cutting"}
			onPress={onPress}
		/>
	);
}

/**
 * The editing tools, in the dock while no layer is selected. On web, each
 * shows the letter that picks it up (see `TOOL_KEYS`) on hover. Add opens
 * the sheet of photos and stickers, and spins while one is on its way.
 * Find, Adjust, and Cut out show only with an image to scan, adjust, or cut
 * out. `vertical` stacks them for a wide screen's rail, where they stay
 * while a tool is in use, marking it.
 */
export function ToolsPanel({
	vertical = false,
	tool,
	addBusy,
	onAddText,
	onDraw,
	onRedact,
	onFind,
	onAdd,
	onCrop,
	onAdjust,
	cutOut,
	onCutOut,
}: {
	vertical?: boolean;
	tool?: "text" | "draw" | "redact" | "find" | "adjust" | null;
	addBusy: boolean;
	onAddText: () => void;
	onDraw: () => void;
	onRedact: () => void;
	onFind?: () => void;
	onAdd: () => void;
	onCrop: () => void;
	onAdjust?: () => void;
	cutOut?: CutOutState;
	onCutOut?: () => void;
}) {
	return (
		<ToolRow vertical={vertical}>
			<ToolButton
				label="Text"
				icon="format-text"
				shortcut={TOOL_KEYS.text}
				selected={tool === "text"}
				onPress={onAddText}
			/>
			<ToolButton
				label="Draw"
				icon="draw"
				shortcut={TOOL_KEYS.draw}
				selected={tool === "draw"}
				onPress={onDraw}
			/>
			<ToolButton
				label="Redact"
				icon="blur"
				shortcut={TOOL_KEYS.redact}
				selected={tool === "redact"}
				onPress={onRedact}
			/>
			{onFind && (
				<ToolButton
					label="Find"
					icon="image-search-outline"
					shortcut={TOOL_KEYS.find}
					selected={tool === "find"}
					onPress={onFind}
				/>
			)}
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
					selected={tool === "adjust"}
					onPress={onAdjust}
				/>
			)}
			{cutOut && onCutOut && <CutOutButton state={cutOut} onPress={onCutOut} />}
		</ToolRow>
	);
}
