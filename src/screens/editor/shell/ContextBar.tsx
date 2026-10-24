import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fadeTo } from "@/ui/gradient";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import { ModeActions } from "./Dock";

// Where the scrolling row fades, so options running past the edge read as
// more to scroll to, like the text panel's font row.
const FADE_WIDTH = 32;

/**
 * The wide editor's header, between Back and the header's actions: the
 * context's name, its options in a row that scrolls when they don't fit,
 * then Cancel and Done. A divider sets those off from Reset, undo, and
 * Export. It's a toolbar for screen readers.
 */
export function ContextBar({
	title,
	onCancel,
	cancelShortcut,
	onDone,
	doneLabel,
	doneShortcut,
	children,
}: {
	title: string;
	onCancel?: () => void;
	cancelShortcut?: string;
	onDone: () => void;
	doneLabel?: string;
	doneShortcut?: string;
	children: ReactNode;
}) {
	return (
		<View
			accessibilityRole="toolbar"
			accessibilityLabel={title}
			style={styles.bar}
		>
			<Text style={styles.name} numberOfLines={1}>
				{title}
			</Text>
			<ScrollFade>{children}</ScrollFade>
			<ModeActions
				onCancel={onCancel}
				cancelShortcut={cancelShortcut}
				onDone={onDone}
				doneLabel={doneLabel}
				doneShortcut={doneShortcut}
			/>
			<View style={styles.divider} />
		</View>
	);
}

/**
 * A segmented row for a bar: one line of names, each a 44-point target, with
 * the chosen one highlighted. `label` names the group for screen readers.
 */
export function OptionSegments({
	label,
	options,
	selected,
	onSelect,
}: {
	label: string;
	options: { title: string }[];
	selected: number;
	onSelect: (index: number) => void;
}) {
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={styles.segments}
		>
			{options.map((option, index) => {
				const chosen = index === selected;
				return (
					<Pressable
						key={option.title}
						accessibilityRole="radio"
						accessibilityLabel={option.title}
						accessibilityState={{ checked: chosen }}
						onPress={() => onSelect(index)}
						style={(state) => {
							const { pressed, hovered } = interaction(state);
							return [
								styles.segment,
								webTransition,
								hovered && styles.segmentHovered,
								pressed && styles.segmentPressed,
							];
						}}
					>
						{chosen && <Highlight />}
						<Text
							style={[styles.segmentLabel, chosen && styles.segmentLabelChosen]}
						>
							{option.title}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function ScrollFade({ children }: { children: ReactNode }) {
	const [width, setWidth] = useState(0);
	const [contentWidth, setContentWidth] = useState(0);
	const [offset, setOffset] = useState(0);
	const more = contentWidth - offset - width > 1;
	return (
		<View style={styles.scroll}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
				scrollEventThrottle={32}
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
				onContentSizeChange={(next) => setContentWidth(next)}
				onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
			>
				{children}
			</ScrollView>
			{more && <View style={styles.fade} />}
		</View>
	);
}

const styles = StyleSheet.create({
	bar: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	name: {
		...typography.bodyStrong,
		flexShrink: 0,
		color: colors.textPrimary,
	},
	scroll: {
		flex: 1,
		minWidth: 0,
	},
	scrollContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
	},
	fade: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 0,
		width: FADE_WIDTH,
		pointerEvents: "none",
		...fadeTo("right", colors.background),
	},
	divider: {
		width: StyleSheet.hairlineWidth,
		alignSelf: "stretch",
		flexShrink: 0,
		marginVertical: 14,
		marginLeft: space.xs,
		backgroundColor: colors.border,
	},
	segments: {
		flexDirection: "row",
		flexShrink: 0,
		alignItems: "center",
	},
	segment: {
		height: 44,
		paddingHorizontal: 12,
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
	},
	segmentHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	segmentPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	segmentLabel: {
		...typography.labelStrong,
		color: colors.textSecondary,
	},
	segmentLabelChosen: {
		color: colors.onHighlight,
	},
});
