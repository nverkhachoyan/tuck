// The buttons the dock, the rail, and the layer actions show. Plain
// TypeScript, so the chrome reads their labels in tests.

import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

export type ToolIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** A subtool choice within a tool group button on the rail or dock. */
export type ToolVariant = {
	id: string;
	label: string;
	icon: ToolIcon;
	shortcut?: string;
};

/** The editor's own entry among the tools' buttons: Add photo. */
export type OwnTool = "photo";

/**
 * A button for a tool or one of the editor's own entries.
 * - `id`: the tool's id, or the entry's name.
 * - `key`: the letter that picks it up.
 * - `shortcut`: its line in the list of shortcuts.
 * - `needsImage`: hidden until the document has an image to work on.
 * - `variants`: subtool choices offered via corner indicator flyout.
 * - `activeVariant`: the currently selected variant id.
 * - `onSelectVariant`: switches to the chosen variant.
 */
export type ToolEntry = {
	id: string;
	label: string;
	icon: ToolIcon;
	key: string;
	shortcut: string;
	needsImage: boolean;
	variants?: readonly ToolVariant[];
	activeVariant?: string;
	onSelectVariant?: (variantId: string) => void;
};

/** The editor's own entry's button; its key is in `TOOL_KEYS`. */
export const TOOLS: Record<
	OwnTool,
	{ label: string; icon: ToolIcon; shortcut: string }
> = {
	photo: {
		label: "Add photo",
		icon: "image-plus-outline",
		shortcut: "Add a photo",
	},
};

export function isOwnTool(id: string): id is OwnTool {
	return id in TOOLS;
}
