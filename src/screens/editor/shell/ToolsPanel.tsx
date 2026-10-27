import type { RefObject } from "react";
import type { View } from "react-native";
import { TOOL_KEYS, type ToolKey } from "../shortcuts";
import { ToolButton, ToolGrid, ToolRow } from "./ToolButton";
import { type MarkedTool, TOOLS } from "./toolList";

/**
 * The editing tools, in the dock while no layer is selected: two rows on a
 * phone (see `ToolGrid`), or with `vertical`, a column for a wide screen's
 * rail, where they stay while a tool is in use, marking it. The tool's options are in the header's context bar, not here.
 * On web, each shows the letter that picks it up (see `TOOL_KEYS`) on hover.
 * Sticker opens the sheet of stickers on a phone, or a popover beside the
 * rail's button (`stickerAnchor`) on a wide window. Add photo picks a photo
 * to add, and spins while one is on its way. Find, Adjust, and Cut out show
 * only with an image to work on.
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
	tool?: MarkedTool | null;
	addBusy: boolean;
	hasImage: boolean;
	startTool: ToolStarters;
	stickerAnchor?: RefObject<View | null>;
}) {
	const compact = !vertical;
	const tools = TOOLS.filter((entry) => !entry.needsImage || hasImage).map(
		(entry) => {
			// The dock highlights the open tool. The rail only bolds its label:
			// the highlighter belongs to the mode in the context bar.
			const open = entry.key === tool;
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
		},
	);
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
	return Object.fromEntries(
		Object.entries(starters).map(([key, start]) => [key, wrap(start)]),
	) as ToolStarters;
}
