import type { OwnTool, ToolEntry } from "./shell/toolList.ts";
import type { ToolSpecs } from "./toolSpec.ts";

// Nudge distances in screen pixels, so a nudge looks the same at any zoom.
const NUDGE_PX = 1;
const NUDGE_FAR_PX = 10;

// A letter picks up a tool, and L shows or hides the layers. Each tool's
// button shows its key on hover. A tool's key is its spec's; this is the
// editor's own entry's. P opens the photo picker.
export const TOOL_KEYS: Record<OwnTool, string> = { photo: "P" };
export const LAYERS_KEY = "L";

/** Each tool's or entry's id, by the letter that picks it up. */
export function toolsByKey(
	tools: readonly Pick<ToolEntry, "id" | "key">[],
	specs?: ToolSpecs,
): ReadonlyMap<string, string> {
	const map = new Map(tools.map((tool) => [tool.key, tool.id]));
	if (specs) {
		for (const tool of tools) {
			for (const id of specs[tool.id]?.grouped ?? []) {
				const spec = specs[id];
				if (spec && !map.has(spec.key)) map.set(spec.key, id);
			}
		}
	}
	return map;
}

export type Shortcut =
	| { type: "undo" }
	| { type: "redo" }
	| { type: "delete" }
	| { type: "deselect" }
	| { type: "edit" }
	| { type: "duplicate" }
	| { type: "reorder"; step: 1 | -1 }
	| { type: "nudge"; dx: number; dy: number }
	| { type: "zoom"; to: "in" | "out" | "fit" }
	| { type: "brushSize"; step: 1 | -1 }
	| { type: "tool"; tool: string }
	| { type: "layers" }
	| { type: "export" }
	| { type: "help" };

export type KeyPress = {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
};

const ARROWS: Record<string, [number, number]> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, -1],
	ArrowDown: [0, 1],
};

/**
 * The editor command for a key press, or null, with `tools` giving the
 * letters that pick up a tool (see `toolsByKey`). ⌘ on a Mac and Ctrl
 * elsewhere are treated alike, and Option/Alt combinations are left to the
 * system.
 */
export function shortcutFor(
	press: KeyPress,
	tools: ReadonlyMap<string, string>,
): Shortcut | null {
	if (press.altKey) return null;
	if (press.metaKey || press.ctrlKey) return modifiedShortcut(press);
	const arrow = ARROWS[press.key];
	if (arrow) {
		const distance = press.shiftKey ? NUDGE_FAR_PX : NUDGE_PX;
		return { type: "nudge", dx: arrow[0] * distance, dy: arrow[1] * distance };
	}
	switch (press.key) {
		// Shift makes it on most layouts, so it's allowed here.
		case "?":
			return { type: "help" };
		case "Delete":
		case "Backspace":
			return { type: "delete" };
		case "Escape":
			return { type: "deselect" };
		// Types into the selected text, as tapping it again does.
		case "Enter":
			return press.shiftKey ? null : { type: "edit" };
	}
	// Shift is left alone, so a capital typed by mistake does nothing.
	if (press.shiftKey) return null;
	// Plain brackets step a brush; ⌘/Ctrl with them reorders layers, above.
	if (press.key === "[") return { type: "brushSize", step: -1 };
	if (press.key === "]") return { type: "brushSize", step: 1 };
	const letter = press.key.toUpperCase();
	if (letter === LAYERS_KEY) return { type: "layers" };
	const tool = tools.get(letter);
	return tool ? { type: "tool", tool } : null;
}

/** The command for a key pressed with ⌘ or Ctrl, or null. */
function modifiedShortcut(press: KeyPress): Shortcut | null {
	switch (press.key.toLowerCase()) {
		case "z":
			return press.shiftKey ? { type: "redo" } : { type: "undo" };
		case "y":
			return { type: "redo" };
		case "d":
			return { type: "duplicate" };
		case "e":
			return { type: "export" };
		case "]":
			return { type: "reorder", step: 1 };
		case "[":
			return { type: "reorder", step: -1 };
		// Plus is Shift and = on most layouts, and on the number pad.
		case "=":
		case "+":
			return { type: "zoom", to: "in" };
		case "-":
			return { type: "zoom", to: "out" };
		case "0":
			return { type: "zoom", to: "fit" };
		default:
			return null;
	}
}

/**
 * Every shortcut, as the help overlay lists them, in the notation tooltips
 * take ("mod+shift+Z"), with a line for each of `tools` (and any grouped
 * under them) in their order, and a group for each tool whose spec in `specs`
 * takes the keys, which Enter (⌘/Ctrl+Enter while typing) applies and Escape
 * cancels.
 */
export function shortcutGroups(
	tools: readonly ToolEntry[],
	specs: ToolSpecs,
): ShortcutGroup[] {
	const keyTakers = tools.filter((tool) => specs[tool.id]?.takesKeys);
	return [
		{
			title: "Tools",
			items: [
				...tools.flatMap((tool) => [
					{ keys: tool.key, action: tool.shortcut },
					...(specs[tool.id]?.grouped ?? []).flatMap((id) =>
						specs[id]
							? [{ keys: specs[id].key, action: specs[id].shortcut }]
							: [],
					),
				]),
				{ keys: LAYERS_KEY, action: "Show or hide layers" },
			],
		},
		...EDITING_GROUPS,
		...keyTakers.map((tool) => ({
			title: tool.label,
			items: [
				{
					keys: specs[tool.id]?.takesKeys === "typing" ? "mod+Enter" : "Enter",
					action: "Apply",
				},
				{ keys: "Escape", action: "Cancel" },
			],
		})),
		HELP_GROUP,
	];
}

export type ShortcutGroup = {
	title: string;
	items: { keys: string; action: string }[];
};

const EDITING_GROUPS: ShortcutGroup[] = [
	{
		title: "Editing",
		items: [
			{ keys: "mod+Z", action: "Undo" },
			{ keys: "mod+shift+Z", action: "Redo" },
			{ keys: "mod+E", action: "Export" },
			{ keys: "mod+D", action: "Duplicate" },
			{ keys: "mod+]", action: "Bring forward" },
			{ keys: "mod+[", action: "Send backward" },
			{ keys: "Delete", action: "Delete" },
			{ keys: "Enter", action: "Done, or edit selected" },
			{ keys: "←↑→↓", action: "Nudge, with Shift for more" },
			{ keys: "[", action: "Smaller brush" },
			{ keys: "]", action: "Larger brush" },
			{ keys: "Escape", action: "Cancel, or deselect" },
		],
	},
	{
		title: "View",
		items: [
			{ keys: "mod+=", action: "Zoom in" },
			{ keys: "mod+-", action: "Zoom out" },
			{ keys: "mod+0", action: "Zoom to fit" },
		],
	},
];

const HELP_GROUP: ShortcutGroup = {
	title: "Help",
	items: [{ keys: "?", action: "Show these shortcuts" }],
};
