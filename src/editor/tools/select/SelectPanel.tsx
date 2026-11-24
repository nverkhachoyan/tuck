import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Announcement } from "@/ui/Announcement";
import { colors, space, typography } from "@/ui/theme";
import { BarButton, BarGroup, BarSections } from "../../shell/ContextBar";
import { ToolButton } from "../../shell/ToolButton";
import type { SelectController } from "./useSelectTool";

const statusLabel = (count: number) =>
	count > 0 ? `${count} selected` : "Tap or drag over layers";

/**
 * Reads out the selection count to a screen reader each time it changes
 * while the tool is open (not when it opens), since the canvas has no focus
 * to announce it from.
 */
function CountAnnouncement({ count }: { count: number }) {
	const [shown, setShown] = useState(count);
	const [message, setMessage] = useState<string | null>(null);
	if (count !== shown) {
		setShown(count);
		setMessage(count > 0 ? `${count} selected` : "Nothing selected");
	}
	return <Announcement message={message} />;
}

/**
 * Select options in the wide editor's header bar:
 * - Select all button (⌘A)
 * - Count of selected layers, or a short prompt when none are selected,
 *   read out as it changes
 */
export function SelectBar({
	controller: { count, canSelectAll, selectAll },
}: {
	controller: SelectController;
}) {
	return (
		<BarSections>
			<BarGroup>
				<BarButton
					label="Select all"
					icon="select-all"
					shortcut="mod+A"
					disabled={!canSelectAll}
					onPress={selectAll}
				/>
			</BarGroup>
			<BarGroup>
				<Text style={styles.barStatus} numberOfLines={1}>
					{statusLabel(count)}
				</Text>
				<CountAnnouncement count={count} />
			</BarGroup>
		</BarSections>
	);
}

/**
 * Select controls in the phone dock: Select all beside the selection count
 * or prompt.
 */
export function SelectPanel({
	controller: { count, canSelectAll, selectAll },
}: {
	controller: SelectController;
}) {
	return (
		<View style={styles.dock}>
			<ToolButton
				label="Select all"
				icon="select-all"
				disabled={!canSelectAll}
				onPress={selectAll}
			/>
			<Text style={styles.dockStatus} numberOfLines={2}>
				{statusLabel(count)}
			</Text>
			<CountAnnouncement count={count} />
		</View>
	);
}

const styles = StyleSheet.create({
	barStatus: {
		...typography.label,
		color: colors.textSecondary,
		fontVariant: ["tabular-nums"],
		paddingHorizontal: space.xs,
	},
	dock: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: space.md,
		paddingHorizontal: space.md,
	},
	dockStatus: {
		...typography.label,
		color: colors.textSecondary,
		fontVariant: ["tabular-nums"],
		flexShrink: 1,
	},
});
