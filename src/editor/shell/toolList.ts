// The editor's tools as the dock, the rail, the layer actions, and the
// chrome name them. Plain TypeScript, so the chrome reads their labels in
// tests.

import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { ToolKey } from "../shortcuts";

type ToolIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

// A tool a button can mark as open.
export type MarkedTool =
	| "text"
	| "draw"
	| "redact"
	| "find"
	| "adjust"
	| "cutOut"
	| "crop"
	| "sticker";

export type ToolEntry = {
	key: ToolKey;
	label: string;
	icon: ToolIcon;
	// Hidden until the document has an image to work on.
	needsImage?: boolean;
};

// The order the dock and the rail show them.
export const TOOLS: readonly ToolEntry[] = [
	{ key: "text", label: "Text", icon: "format-text" },
	{ key: "draw", label: "Draw", icon: "draw" },
	{ key: "redact", label: "Redact", icon: "blur" },
	{
		key: "find",
		label: "Find",
		icon: "image-search-outline",
		needsImage: true,
	},
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

/** What a tool's button, footer, and bar call it. */
export function toolLabel(key: ToolKey): string {
	return TOOLS.find((entry) => entry.key === key)?.label ?? key;
}
