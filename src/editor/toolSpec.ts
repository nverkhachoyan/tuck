import type { Layer } from "./layers/layer.ts";
import type { ToolIcon } from "./shell/toolList.ts";

/** A tool's name in the editor: its key in the list of tools. */
export type ToolId = string;

/**
 * What the mode, the chrome, and the shortcuts need to know of one of the
 * editor's tools, in plain TypeScript beside its definition, so Node's tests
 * can read it.
 * - `target`: what it works on. "none" needs nothing; "photo" needs a photo
 *   to work in, and is put down when the last one goes; "image" works on
 *   the image it started on, and is put down when that one is hidden or
 *   gone. A tool with a target waits for an image before its button shows.
 * - `tray`: whether it has a tray of options on the phone.
 * - `sized`: whether `[` and `]` step its brush.
 * - `takesKeys`: whether it keeps a draft of its own until Done. While it's
 *   open the editor's shortcuts, paste, and drop are off, Escape cancels,
 *   Enter runs Done, Export hides, and the layers can't be changed. "typing"
 *   for one that types into a hidden input (its definition's `views.Input`):
 *   Enter is a new line and ⌘/Ctrl+Enter runs Done, the dock rides the
 *   keyboard, and a press in the context bar or dock keeps the input's focus.
 * - `previews`: whether what it does to the document until Done is only a
 *   preview, as Cut's selection is: meanwhile the app (autosave,
 *   thumbnails) sees the document from before it opened.
 * - `action`: whether pressing it runs its definition's `run` on its target
 *   and opens no mode, as Remove BG does.
 * - `grouped`: other tools folded into this button's flyout on the toolbar,
 *   still reachable by their own shortcut and in a selected layer's actions.
 * - `label`, `icon`: its button, and the title of its panel.
 * - `key`: the letter that picks it up.
 * - `shortcut`: its line in the list of shortcuts.
 * - `actsOn`: whether a selected `layer` offers it among its actions.
 */
export type ToolSpec = {
	target: "none" | "photo" | "image";
	tray: boolean;
	sized: boolean;
	takesKeys?: true | "typing";
	previews?: true;
	action?: true;
	grouped?: readonly ToolId[];
	label: string;
	icon: ToolIcon;
	key: string;
	shortcut: string;
	actsOn: (layer: Layer) => boolean;
};

/** Each tool's spec, by its id. */
export type ToolSpecs = Readonly<Record<ToolId, ToolSpec>>;
