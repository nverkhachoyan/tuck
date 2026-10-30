import type { RefObject } from "react";
import type { ViewInstance } from "react-native";
import { ToolButton, ToolGrid, ToolRow } from "./ToolButton";
import type { ToolEntry } from "./toolList";

/**
 * The editing tools' buttons (`tools`, in order), in the dock while no layer
 * is selected: two rows on a phone (see `ToolGrid`), or with `vertical`, a
 * column for a wide screen's rail, where they stay while a tool is in use,
 * marking it. The tool's options are in the header's context bar, not here.
 * On web, each shows the letter that picks it up on hover. A tool with a
 * sheet opens it beside its rail button on a wide window, which `anchors`
 * gives by the tool's id. A button in `busy` spins, as Add photo does
 * while a photo is on its way. A tool that needs an image shows only with
 * one to work on.
 */
export function ToolsPanel({
	tools: entries,
	vertical = false,
	tool,
	busy,
	hasImage,
	startTool,
	anchors,
}: {
	tools: readonly ToolEntry[];
	vertical?: boolean;
	tool?: string | null;
	busy: readonly string[];
	hasImage: boolean;
	startTool: ToolStarters;
	anchors?: Readonly<Record<string, RefObject<ViewInstance | null>>>;
}) {
	const compact = !vertical;
	const tools = entries
		.filter((entry) => !entry.needsImage || hasImage)
		.map((entry) => {
			// The dock highlights the open tool. The rail only bolds its label:
			// the highlighter belongs to the mode in the context bar.
			const open = entry.id === tool;
			return (
				<ToolButton
					key={entry.id}
					label={entry.label}
					icon={entry.icon}
					shortcut={entry.key}
					compact={compact}
					selected={vertical ? undefined : open}
					marked={vertical ? open : undefined}
					busy={busy.includes(entry.id)}
					buttonRef={anchors?.[entry.id]}
					onPress={startTool[entry.id]}
				/>
			);
		});
	return vertical ? (
		<ToolRow vertical>{tools}</ToolRow>
	) : (
		<ToolGrid>{tools}</ToolGrid>
	);
}

/** What picking up each tool or entry does, as its key would, by its id. */
export type ToolStarters = Record<string, () => void>;

/** Each starter passed through `wrap`, as the rail does with `fromRail`. */
export function mapStarters(
	starters: ToolStarters,
	wrap: (start: () => void) => () => void,
): ToolStarters {
	return Object.fromEntries(
		Object.entries(starters).map(([id, start]) => [id, wrap(start)]),
	);
}
