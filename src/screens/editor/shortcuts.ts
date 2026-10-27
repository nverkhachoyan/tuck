// Nudge distances in screen pixels, so a nudge looks the same at any zoom.
const NUDGE_PX = 1;
const NUDGE_FAR_PX = 10;

export type ToolKey =
	| "text"
	| "draw"
	| "redact"
	| "find"
	| "sticker"
	| "photo"
	| "crop"
	| "adjust"
	| "cutOut";

// A letter picks up a tool, and L shows or hides the layers. Each tool's
// button shows its key on hover. A opens the stickers (it was Add's), P the
// photo picker, and F Redact's Find. E adjusts, since A is taken, and B cuts
// out the subject, taking its background away.
export const TOOL_KEYS: Record<ToolKey, string> = {
	text: "T",
	draw: "D",
	redact: "R",
	find: "F",
	sticker: "A",
	photo: "P",
	crop: "C",
	adjust: "E",
	cutOut: "B",
};
export const LAYERS_KEY = "L";

const TOOLS_BY_KEY = new Map(
	Object.entries(TOOL_KEYS).map(([tool, key]) => [key, tool as ToolKey]),
);

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
	| { type: "tool"; tool: ToolKey }
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
 * The editor command for a key press, or null. ⌘ on a Mac and Ctrl
 * elsewhere are treated alike, and Option/Alt combinations are left to the
 * system.
 */
export function shortcutFor(press: KeyPress): Shortcut | null {
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
	const tool = TOOLS_BY_KEY.get(letter);
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
 * take ("mod+shift+Z").
 */
export const SHORTCUT_GROUPS: {
	title: string;
	items: { keys: string; action: string }[];
}[] = [
	{
		title: "Tools",
		items: [
			{ keys: TOOL_KEYS.text, action: "Add text" },
			{ keys: TOOL_KEYS.draw, action: "Draw" },
			{ keys: TOOL_KEYS.redact, action: "Redact" },
			{ keys: TOOL_KEYS.find, action: "Find faces or text to redact" },
			{ keys: TOOL_KEYS.sticker, action: "Add a sticker" },
			{ keys: TOOL_KEYS.photo, action: "Add a photo" },
			{ keys: TOOL_KEYS.crop, action: "Crop" },
			{ keys: TOOL_KEYS.adjust, action: "Adjust" },
			{ keys: TOOL_KEYS.cutOut, action: "Cut out" },
			{ keys: LAYERS_KEY, action: "Show or hide layers" },
		],
	},
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
			{ keys: "Enter", action: "Edit the selected text" },
			{ keys: "←↑→↓", action: "Nudge, with Shift for more" },
			{ keys: "[", action: "Smaller brush" },
			{ keys: "]", action: "Larger brush" },
			{ keys: "Escape", action: "Done, or deselect" },
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
	{
		title: "Crop",
		items: [
			{ keys: "Enter", action: "Apply" },
			{ keys: "Escape", action: "Apply" },
		],
	},
	{
		title: "Help",
		items: [{ keys: "?", action: "Show these shortcuts" }],
	},
];
