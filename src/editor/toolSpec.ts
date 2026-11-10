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
 * - `stickers`: whether a selected sticker counts as the image it opens on
 *   when `target` is "image" (Adjust).
 * - `tray`: whether it has a tray of options on the phone.
 * - `sized`: whether `[` and `]` step its brush.
 * - `takesKeys`: whether it keeps a draft of its own until Done. While it's
 *   open the editor's shortcuts, paste, and drop are off, Escape cancels,
 *   Enter runs Done, Export hides, and the layers can't be changed. "typing"
 *   for one that types into a hidden input (its definition's `views.Input`):
 *   Escape runs Done, Enter is a new line and ⌘/Ctrl+Enter runs Done, the
 *   dock rides the keyboard, and a press in the context bar or dock keeps
 *   the input's focus.
 * - `previews`: whether what it does to the document until Done is only a
 *   preview (Cut's selection), which any other close (Escape, Back, another
 *   tool) drops with the rest of the session, though a tap away leaves it
 *   open once it has changed something. Meanwhile the app (autosave,
 *   thumbnails) sees the document from before it opened.
 * - `picks`: whether what it does until Done is only picked in the tool,
 *   leaving the document alone (Find's chosen regions). Cancel, Escape, and
 *   another tool drop the picks and keep the document, a tap away leaves it
 *   open while it holds some (its definition's `holds`), and leaving the
 *   editor runs Done, so nothing picked is left unapplied.
 * - `undoSteps`: what its changes become once it's done, when that isn't one
 *   undo step: one per change ("each", the Eraser's swipes) or one per mark,
 *   a run of changes to the same layer ("marks": Pen's strokes, a shape
 *   or redaction with its resizes and restyles).
 * - `cancels`: whether its panel offers Cancel, for a draft, a preview, or
 *   settings tried out (Crop, Cut, Find, Adjust). Any other tool's work is
 *   in the document as it's made, and undo takes it back.
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
	stickers?: true;
	tray: boolean;
	sized: boolean;
	takesKeys?: true | "typing";
	previews?: true;
	picks?: true;
	undoSteps?: "each" | "marks";
	cancels?: true;
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

/** Whether closing the tool any way but Done drops its work (Cut, Find). */
export function dropsWork(spec: ToolSpec | undefined): boolean {
	return spec?.previews === true || spec?.picks === true;
}

/**
 * Whether Escape drops the tool's work, as its Cancel does: Crop's draft,
 * and what `dropsWork` (Cut's preview, Find's picks). A typing tool keeps
 * what's typed, and any other is put down with its work kept.
 */
export function escapeCancels(spec: ToolSpec | undefined): boolean {
	if (spec?.takesKeys) return spec.takesKeys === true;
	return dropsWork(spec);
}
