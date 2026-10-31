import { useRef, useState } from "react";
import { useWindowDimensions, type ViewInstance } from "react-native";
import { compactControls } from "@/ui/density";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import { editorFrame } from "./editorFrame";
import { LAYERS_SIDEBAR_INSET } from "./layers/panel/LayersPanel";
import {
	CARD_HEIGHT,
	INSPECTOR_WIDTH,
	PANEL_GAP,
	useDockInset,
} from "./shell/Dock";

// Room for the chosen tool's highlight inside the rail's card, and for its
// longest label ("Remove BG", in bold) on one line. Its tools are smaller
// where controls are sized for a mouse.
export const RAIL_WIDTH = compactControls ? 70 : 84;
// How much of the canvas's sides the rail and the inspector cover, with the
// gaps around their cards.
export const RAIL_INSET = RAIL_WIDTH + 2 * PANEL_GAP;
const INSPECTOR_INSET = INSPECTOR_WIDTH + 2 * PANEL_GAP;
// How much of the canvas's bottom a tool's card covers, with its gaps.
const CARD_INSET = CARD_HEIGHT + 2 * PANEL_GAP;

/**
 * Where the editor's parts go for the window, and how much of the canvas
 * they cover.
 * - `layersOpen`: opens the side panel when the window isn't tall enough to pin it.
 * - `cardOpen`: reserves a constant `CARD_INSET` at the bottom on wide screens so the photo doesn't shift as card content changes.
 * - `typing`: floats the dock above the keyboard (`stageRef`) and fits the document above it.
 */
export function useEditorLayout({
	typing,
	layersOpen,
	cardOpen,
}: {
	typing: boolean;
	layersOpen: boolean;
	cardOpen: boolean;
}) {
	const { width: windowWidth, height: windowHeight } = useWindowDimensions();
	const { wide, layersBeside, inspectorPinned } = editorFrame(
		windowWidth,
		windowHeight,
	);
	// A short wide window (a 13-inch laptop) leaves the inspector closed, so
	// the photo keeps the width the panel would have taken.
	const inspector = wide && (inspectorPinned || layersOpen);
	const stageRef = useRef<ViewInstance>(null);
	const keyboardOverlap = useKeyboardOverlap(stageRef, typing);
	const barInset = useDockInset(keyboardOverlap);
	// As an inspector, the dock covers none of the canvas's bottom.
	const dockInset = wide ? 0 : barInset;
	// An open tray's height: the canvas fits above it as well as the dock. A
	// wide window's card stands in the same place, with a gap above and below.
	const [trayHeight, setTrayHeight] = useState(0);
	const coveredBottom = wide
		? cardOpen
			? CARD_INSET
			: 0
		: dockInset + trayHeight;
	return {
		wide,
		layersBeside,
		inspector,
		inspectorPinned,
		stageRef,
		keyboardOverlap,
		dockInset,
		setTrayHeight,
		canvasInset: {
			left: wide ? RAIL_INSET : 0,
			// Clear of the inspector while it's open, and of the screen edge
			// while the rail's side is the only card on the table.
			right: inspector ? INSPECTOR_INSET : wide ? PANEL_GAP : 0,
			bottom: coveredBottom,
		},
		// What covers the canvas's right edge, which a notice over the canvas
		// keeps clear of: the inspector, or an open layers sidebar.
		coveredRight: inspector
			? INSPECTOR_INSET
			: layersBeside && layersOpen
				? LAYERS_SIDEBAR_INSET
				: undefined,
		// The dock and its open tray or card, which a notice sits above.
		coveredBottom,
	};
}
