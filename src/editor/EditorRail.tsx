import type { RefObject } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import { Surface } from "@/ui/Surface";
import { colors, space } from "@/ui/theme";
import { PANEL_GAP, PANEL_RADIUS } from "./shell/Dock";
import { ToolButton } from "./shell/ToolButton";
import { mapStarters, type ToolStarters, ToolsPanel } from "./shell/ToolsPanel";
import type { ToolEntry } from "./shell/toolList";
import type { ToolId } from "./toolSpec";
import { RAIL_WIDTH } from "./useEditorLayout";

/**
 * The editing tools on a wide screen, in a card floating along the left.
 * Picking a tool while another is open finishes the earlier one first.
 */
export function EditorRail({
	tools,
	chosen,
	busy,
	hasImage,
	startTool,
	tool,
	finishTool,
	sheetAnchors,
	onShortcuts,
}: {
	tools: readonly ToolEntry[];
	chosen: string | null;
	busy: readonly string[];
	hasImage: boolean;
	startTool: ToolStarters;
	tool: ToolId | null;
	finishTool: () => void;
	sheetAnchors?: Readonly<Record<string, RefObject<ViewInstance | null>>>;
	onShortcuts?: () => void;
}) {
	// A tool picked from the rail while another is open finishes that one.
	const fromRail = (start: () => void) => () => {
		if (tool) finishTool();
		start();
	};
	return (
		<View style={styles.railArea}>
			<Surface resting style={styles.rail} contentStyle={styles.railContent}>
				<ToolsPanel
					tools={tools}
					vertical
					tool={chosen}
					busy={busy}
					hasImage={hasImage}
					startTool={mapStarters(startTool, fromRail)}
					anchors={sheetAnchors}
				/>
				{onShortcuts && (
					<View style={styles.footer}>
						<View style={styles.divider} />
						<ToolButton
							label="Help"
							icon="help-circle-outline"
							shortcut="?"
							compact={false}
							onPress={onShortcuts}
						/>
					</View>
				)}
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
	footer: {
		alignItems: "center",
		paddingBottom: space.xs,
	},
	divider: {
		width: 32,
		height: StyleSheet.hairlineWidth,
		backgroundColor: colors.border,
		marginVertical: 4,
	},
});
