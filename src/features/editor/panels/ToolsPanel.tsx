import { TOOL_KEYS } from "../shortcuts";
import { ToolButton, ToolGrid, ToolRow } from "../ToolButton";

/** Whether the image Cut out acts on is cut out already, or being cut out. */
export type CutOutState = "whole" | "cutting" | "cut";

/**
 * Cuts the subject out of an image, spinning while it's found, or once it
 * has, brings the background back.
 */
export function CutOutButton({
	state,
	compact,
	onPress,
}: {
	state: CutOutState;
	compact?: boolean;
	onPress: () => void;
}) {
	return (
		<ToolButton
			label={state === "cut" ? "Undo cut" : "Cut out"}
			icon={state === "cut" ? "image-refresh-outline" : "scissors-cutting"}
			shortcut={TOOL_KEYS.cutOut}
			busy={state === "cutting"}
			compact={compact}
			onPress={onPress}
		/>
	);
}

/**
 * The editing tools, in the dock while no layer is selected: two rows on a
 * phone (see `ToolGrid`), or with `vertical`, a column for a wide screen's
 * rail, where they stay while a tool is in use, marking it (Find is
 * Redact's). On web, each shows the letter that picks it up (see
 * `TOOL_KEYS`) on hover. Sticker opens the sheet of stickers; Add photo picks a
 * photo to add, and spins while one is on its way. Adjust and Cut out show
 * only with an image to adjust or cut out.
 */
export function ToolsPanel({
	vertical = false,
	tool,
	addBusy,
	onAddText,
	onDraw,
	onRedact,
	onSticker,
	onPhoto,
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
	onSticker: () => void;
	onPhoto: () => void;
	onCrop: () => void;
	onAdjust?: () => void;
	cutOut?: CutOutState;
	onCutOut?: () => void;
}) {
	const compact = !vertical;
	const tools = [
		<ToolButton
			key="text"
			label="Text"
			icon="format-text"
			shortcut={TOOL_KEYS.text}
			compact={compact}
			selected={tool === "text"}
			onPress={onAddText}
		/>,
		<ToolButton
			key="draw"
			label="Draw"
			icon="draw"
			shortcut={TOOL_KEYS.draw}
			compact={compact}
			selected={tool === "draw"}
			onPress={onDraw}
		/>,
		<ToolButton
			key="redact"
			label="Redact"
			icon="blur"
			shortcut={TOOL_KEYS.redact}
			compact={compact}
			selected={tool === "redact" || tool === "find"}
			onPress={onRedact}
		/>,
		<ToolButton
			key="sticker"
			label="Sticker"
			icon="sticker-emoji"
			shortcut={TOOL_KEYS.add}
			compact={compact}
			onPress={onSticker}
		/>,
		<ToolButton
			key="crop"
			label="Crop"
			icon="crop-rotate"
			shortcut={TOOL_KEYS.crop}
			compact={compact}
			onPress={onCrop}
		/>,
		onAdjust && (
			<ToolButton
				key="adjust"
				label="Adjust"
				icon="tune-variant"
				shortcut={TOOL_KEYS.adjust}
				compact={compact}
				selected={tool === "adjust"}
				onPress={onAdjust}
			/>
		),
		cutOut && onCutOut && (
			<CutOutButton
				key="cutOut"
				state={cutOut}
				compact={compact}
				onPress={onCutOut}
			/>
		),
		<ToolButton
			key="photo"
			label="Add photo"
			icon="image-plus-outline"
			shortcut={TOOL_KEYS.photo}
			compact={compact}
			busy={addBusy}
			onPress={onPhoto}
		/>,
	];
	return vertical ? (
		<ToolRow vertical>{tools}</ToolRow>
	) : (
		<ToolGrid>{tools}</ToolGrid>
	);
}
