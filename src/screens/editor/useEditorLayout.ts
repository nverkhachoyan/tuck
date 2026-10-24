import { useRef, useState } from "react";
import { useWindowDimensions, type View } from "react-native";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import { INSPECTOR_WIDTH, PANEL_GAP, useDockInset } from "./shell/Dock";
import { LAYERS_SIDEBAR_INSET } from "./tools/layers/LayersPanel";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;
// Wide enough for a tool rail at the left and an inspector at the right.
// The rail picks a tool; its options go in the header, and the inspector
// keeps the layers. Phones keep the dock and its trays.
const INSPECTOR_MIN_WIDTH = 1024;
// Room for the chosen tool's highlight inside the rail's card.
export const RAIL_WIDTH = 84;
// How much of the canvas's sides the rail and the inspector cover, with the
// gaps around their cards.
export const RAIL_INSET = RAIL_WIDTH + 2 * PANEL_GAP;
const INSPECTOR_INSET = INSPECTOR_WIDTH + 2 * PANEL_GAP;

/**
 * Where the editor's parts go for the window's width, and how much of the
 * canvas they cover. While `typing`, the dock rides the keyboard over the
 * stage (`stageRef`), bringing the text's style and Done, and the document
 * fits above them.
 */
export function useEditorLayout({
	typing,
	layersOpen,
}: {
	typing: boolean;
	layersOpen: boolean;
}) {
	const windowWidth = useWindowDimensions().width;
	const layersBeside = windowWidth >= SIDEBAR_MIN_WIDTH;
	const wide = windowWidth >= INSPECTOR_MIN_WIDTH;
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
		stageRef,
		keyboardOverlap,
		dockInset,
		setTrayHeight,
		canvasInset: {
			left: wide ? RAIL_INSET : 0,
			right: wide ? INSPECTOR_INSET : 0,
			bottom: wide ? 0 : dockInset + trayHeight,
		},
		// What covers the canvas's right edge, which a notice over the canvas
		// keeps clear of: the inspector, or an open layers sidebar.
		coveredRight: wide
			? INSPECTOR_INSET
			: layersBeside && layersOpen
				? LAYERS_SIDEBAR_INSET
				: undefined,
		// The dock and its open tray, which a notice sits above.
		coveredBottom: dockInset + trayHeight,
	};
}
