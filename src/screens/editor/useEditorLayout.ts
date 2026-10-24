import { useRef, useState } from "react";
import { useWindowDimensions, type View } from "react-native";
import { compactControls } from "@/ui/density";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import { editorFrame } from "./editorFrame";
import { INSPECTOR_WIDTH, PANEL_GAP, useDockInset } from "./shell/Dock";
import { LAYERS_SIDEBAR_INSET } from "./tools/layers/LayersPanel";

// Room for the chosen tool's highlight inside the rail's card. Its tools are
// smaller where controls are sized for a mouse.
export const RAIL_WIDTH = compactControls ? 64 : 84;
// How much of the canvas's sides the rail and the inspector cover, with the
// gaps around their cards.
export const RAIL_INSET = RAIL_WIDTH + 2 * PANEL_GAP;
const INSPECTOR_INSET = INSPECTOR_WIDTH + 2 * PANEL_GAP;

/**
 * Where the editor's parts go for the window, and how much of the canvas
 * they cover. `inspectorRequested` is Layers, Find, or Adjust asking for the
 * side panel; a tall window shows it anyway. While `typing`, the dock rides
 * the keyboard over the stage (`stageRef`), bringing the text's style and
 * Done, and the document fits above them.
 */
export function useEditorLayout({
	typing,
	layersOpen,
	inspectorRequested,
}: {
	typing: boolean;
	layersOpen: boolean;
	inspectorRequested: boolean;
}) {
	const { width: windowWidth, height: windowHeight } = useWindowDimensions();
	const { wide, layersBeside, inspectorPinned } = editorFrame(
		windowWidth,
		windowHeight,
	);
	// A short wide window (a 13-inch laptop) leaves the inspector closed, so
	// the photo keeps the width the panel would have taken.
	const inspector = wide && (inspectorPinned || inspectorRequested);
	const stageRef = useRef<View>(null);
	const keyboardOverlap = useKeyboardOverlap(stageRef, typing);
	const barInset = useDockInset(keyboardOverlap);
	// As an inspector, the dock covers none of the canvas's bottom.
	const dockInset = wide ? 0 : barInset;
	// An open tray's height: the canvas fits above it as well as the dock.
	const [trayHeight, setTrayHeight] = useState(0);
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
			bottom: wide ? 0 : dockInset + trayHeight,
		},
		// What covers the canvas's right edge, which a notice over the canvas
		// keeps clear of: the inspector, or an open layers sidebar.
		coveredRight: inspector
			? INSPECTOR_INSET
			: layersBeside && layersOpen
				? LAYERS_SIDEBAR_INSET
				: undefined,
		// The dock and its open tray, which a notice sits above.
		coveredBottom: dockInset + trayHeight,
	};
}
