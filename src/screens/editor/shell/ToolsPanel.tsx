import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps, RefObject } from "react";
import type { View } from "react-native";
import { TOOL_KEYS, type ToolKey } from "../shortcuts";
import { ToolButton, ToolGrid, ToolRow } from "./ToolButton";

type ToolIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

// A tool the dock can be showing. Find is one of Redact's, so it marks
// Redact rather than a button of its own.
type OpenTool =
	| "text"
	| "draw"
	| "redact"
	| "find"
	| "adjust"
	| "cutOut"
	| "crop"
	| "sticker";

type ToolEntry = {
	key: ToolKey;
	label: string;
	icon: ToolIcon;
	// Hidden until the document has an image to work on.
	needsImage?: boolean;
	// Find is a layer action, not a button in the dock or the rail.
	dock?: false;
	// Which open tools mark this button. Redact stays marked while Find is open.
	markedWhile?: readonly OpenTool[];
};

// The order the dock and the rail show them.
export const TOOLS: readonly ToolEntry[] = [
	{ key: "text", label: "Text", icon: "format-text" },
	{ key: "draw", label: "Draw", icon: "draw" },
	{
		key: "redact",
		label: "Redact",
		icon: "blur",
		markedWhile: ["redact", "find"],
	},
	{ key: "find", label: "Find", icon: "image-search-outline", dock: false },
	{ key: "sticker", label: "Sticker", icon: "sticker-emoji" },
	{ key: "crop", label: "Crop", icon: "crop-rotate" },
	{ key: "adjust", label: "Adjust", icon: "tune-variant", needsImage: true },
	{
		key: "cutOut",
		label: "Cut out",
		icon: "scissors-cutting",
		needsImage: true,
	},
	{ key: "photo", label: "Add photo", icon: "image-plus-outline" },
];

/**
 * The editing tools, in the dock while no layer is selected: two rows on a
 * phone (see `ToolGrid`), or with `vertical`, a column for a wide screen's
 * rail, where they stay while a tool is in use, marking it (Find is
 * Redact's). The tool's options are in the header's context bar, not here.
 * On web, each shows the letter that picks it up (see `TOOL_KEYS`) on hover.
 * Sticker opens the sheet of stickers on a phone, or a popover beside the
 * rail's button (`stickerAnchor`) on a wide window. Add photo picks a photo
 * to add, and spins while one is on its way. Adjust and Cut out show only
 * with an image to adjust or cut out.
 */
export function ToolsPanel({
	vertical = false,
	tool,
	addBusy,
	hasImage,
	startTool,
	stickerAnchor,
}: {
	vertical?: boolean;
	tool?: OpenTool | null;
	addBusy: boolean;
	hasImage: boolean;
	startTool: ToolStarters;
	stickerAnchor?: RefObject<View | null>;
}) {
	const compact = !vertical;
	const tools = TOOLS.filter(
		(entry) => entry.dock !== false && (!entry.needsImage || hasImage),
	).map((entry) => {
		// The dock highlights the open tool. The rail only bolds its label:
		// the highlighter belongs to the mode in the context bar.
		const open =
			tool != null &&
			(entry.markedWhile ?? [entry.key]).some((mark) => mark === tool);
		return (
			<ToolButton
				key={entry.key}
				label={entry.label}
				icon={entry.icon}
				shortcut={TOOL_KEYS[entry.key]}
				compact={compact}
				selected={vertical ? undefined : open}
				marked={vertical ? open : undefined}
				busy={entry.key === "photo" && addBusy}
				buttonRef={entry.key === "sticker" ? stickerAnchor : undefined}
				onPress={startTool[entry.key]}
			/>
		);
	});
	return vertical ? (
		<ToolRow vertical>{tools}</ToolRow>
	) : (
		<ToolGrid>{tools}</ToolGrid>
	);
}

/** What picking up each tool does, as its key would (see `TOOL_KEYS`). */
export type ToolStarters = Record<ToolKey, () => void>;

/** Each starter passed through `wrap`, as the rail does with `fromRail`. */
export function mapStarters(
	starters: ToolStarters,
	wrap: (start: () => void) => () => void,
): ToolStarters {
	return {
		text: wrap(starters.text),
		draw: wrap(starters.draw),
		redact: wrap(starters.redact),
		find: wrap(starters.find),
		sticker: wrap(starters.sticker),
		photo: wrap(starters.photo),
		crop: wrap(starters.crop),
		adjust: wrap(starters.adjust),
		cutOut: wrap(starters.cutOut),
	};
}
