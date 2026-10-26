import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { Surface } from "@/ui/Surface";
import type { RailTool } from "./editorChrome";
import type { EditorTool } from "./editorMode";
import { PANEL_GAP, PANEL_RADIUS } from "./shell/Dock";
import { mapStarters, type ToolStarters, ToolsPanel } from "./shell/ToolsPanel";
import { RAIL_WIDTH } from "./useEditorLayout";

/**
 * The editing tools on a wide screen, in a card floating along the left.
 * Picking a tool while another is open finishes the earlier one first.
 */
export function EditorRail({
	chosen,
	addBusy,
	hasImage,
	startTool,
	tool,
	finishTool,
	finishText,
	stickerAnchor,
}: {
	chosen: RailTool | null;
	addBusy: boolean;
	hasImage: boolean;
	startTool: ToolStarters;
	tool: EditorTool | null;
	finishTool: () => void;
	finishText: () => void;
	stickerAnchor?: RefObject<View | null>;
}) {
	// A tool picked from the rail while another is open finishes that one.
	const fromRail = (start: () => void) => () => {
		if (tool) finishTool();
		finishText();
		start();
	};
	return (
		<View style={styles.railArea}>
			<Surface resting style={styles.rail} contentStyle={styles.railContent}>
				<ToolsPanel
					vertical
					tool={chosen}
					addBusy={addBusy}
					hasImage={hasImage}
					startTool={mapStarters(startTool, fromRail)}
					stickerAnchor={stickerAnchor}
				/>
			</Surface>
		</View>
	);
}

const styles = StyleSheet.create({
	// The rail's card is as tall as its tools, and scrolls them only when the
	// window is shorter.
	railArea: {
		position: "absolute",
		top: PANEL_GAP,
		left: PANEL_GAP,
		bottom: PANEL_GAP,
		width: RAIL_WIDTH,
		pointerEvents: "box-none",
	},
	rail: {
		flexShrink: 1,
		borderRadius: PANEL_RADIUS,
	},
	railContent: {
		flexShrink: 1,
	},
});
