import { useRef, useState } from "react";
import { useWindowDimensions, type View } from "react-native";
import { useKeyboardOverlap } from "@/ui/useKeyboardOverlap";
import {
	INSPECTOR_TRAY_TOP,
	INSPECTOR_WIDTH,
	useDockInset,
} from "./shell/Dock";
import { LAYERS_SIDEBAR_INSET } from "./tools/layers/LayersPanel";

// Wide enough to show layers in a sidebar rather than a bottom sheet.
const SIDEBAR_MIN_WIDTH = 900;
// Wide enough for a tool rail at the left and an inspector at the right,
// which the dock, its trays, and the layers move into.
const INSPECTOR_MIN_WIDTH = 1024;
export const RAIL_WIDTH = 76;
const INSPECTOR_TRAY = { top: INSPECTOR_TRAY_TOP, width: INSPECTOR_WIDTH };

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
		trayPlacement: wide ? INSPECTOR_TRAY : null,
		canvasInset: {
			left: wide ? RAIL_WIDTH : 0,
			right: wide ? INSPECTOR_WIDTH : 0,
			bottom: wide ? 0 : dockInset + trayHeight,
		},
		// What covers the canvas's right edge, which a notice over the canvas
		// keeps clear of: the inspector, or an open layers sidebar.
		coveredRight: wide
			? INSPECTOR_WIDTH
			: layersBeside && layersOpen
				? LAYERS_SIDEBAR_INSET
				: undefined,
		// The dock and its open tray, which a notice sits above.
		coveredBottom: dockInset + trayHeight,
	};
}
