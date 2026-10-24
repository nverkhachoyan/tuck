import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { fadeTo } from "@/ui/gradient";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";
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
	keepFocus = false,
	children,
}: {
	title: string;
	onCancel?: () => void;
	cancelShortcut?: string;
	onDone: () => void;
	doneLabel?: string;
	doneShortcut?: string;
	// While text is being typed, a press in the bar must not take the caret
	// from the hidden input. Canceling the press's default leaves it there.
	keepFocus?: boolean;
	children: ReactNode;
}) {
	const barRef = useRef<View>(null);
	useEffect(() => {
		if (!keepFocus || Platform.OS !== "web") return;
		const node = barRef.current as unknown as HTMLElement | null;
		// Capture, before the control itself: the browser moves focus on
		// pointer-down unless that default is canceled. The canvas does the
		// same so a tap there places the caret instead of dismissing the key.
		const keep = (event: MouseEvent) => event.preventDefault();
		node?.addEventListener("mousedown", keep, true);
		return () => node?.removeEventListener("mousedown", keep, true);
	}, [keepFocus]);
	return (
		<View
			ref={barRef}
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

type BarIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

type SegmentOption = {
	title: string;
	icon?: BarIcon;
	busy?: boolean;
};

/**
 * One choice among a tool's modes, as a single control: an icon and its
 * name in each segment, the chosen one marked with the highlighter. The
 * icon is the same glyph the dock uses for that mode. `label` names the
 * group for screen readers.
 */
export function OptionSegments({
	label,
	options,
	selected,
	onSelect,
}: {
	label: string;
	options: readonly SegmentOption[];
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
				const busy = option.busy === true;
				const ink = chosen ? colors.onHighlight : colors.textPrimary;
				return (
					<Pressable
						key={option.title}
						accessibilityRole="radio"
						accessibilityLabel={option.title}
						accessibilityState={{ checked: chosen, busy, disabled: busy }}
						disabled={busy}
						onPress={() => onSelect(index)}
						style={(state) => {
							const { pressed, hovered } = interaction(state);
							return [
								styles.segment,
								webTransition,
								hovered && !busy && !chosen && styles.segmentHovered,
								pressed && !busy && styles.segmentPressed,
							];
						}}
					>
						{chosen && <Highlight />}
						{busy ? (
							<ActivityIndicator color={colors.textPrimary} />
						) : (
							<>
								{option.icon && (
									<MaterialCommunityIcons
										name={option.icon}
										size={18}
										color={ink}
									/>
								)}
								<Text
									style={[
										styles.segmentLabel,
										chosen && styles.segmentLabelChosen,
									]}
								>
									{option.title}
								</Text>
							</>
						)}
					</Pressable>
				);
			})}
		</View>
	);
}

/** A short rule between a bar's mode and the options that follow it. */
export function BarRule() {
	return <View style={styles.rule} />;
}

/**
 * A labeled action in the bar, 44 points tall, beside the segmented sub-tools.
 * `busy` swaps its icon for a spinner and ignores presses, as a tool button does.
 */
export function BarButton({
	label,
	icon,
	shortcut,
	busy = false,
	disabled = false,
	onPress,
}: {
	label: string;
	icon: BarIcon;
	shortcut?: string;
	busy?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const inactive = busy || disabled;
	return (
		<>
			<Pressable
				{...anchor}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ disabled: inactive, busy }}
				disabled={inactive}
				onPress={onPress}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.action,
						webTransition,
						inactive && styles.actionInactive,
						hovered && !inactive && styles.segmentHovered,
						pressed && !inactive && styles.segmentPressed,
					];
				}}
			>
				{busy ? (
					<ActivityIndicator color={colors.textPrimary} />
				) : (
					<MaterialCommunityIcons
						name={icon}
						size={20}
						color={colors.textPrimary}
					/>
				)}
				<Text style={styles.actionLabel}>{label}</Text>
			</Pressable>
			{tooltip}
		</>
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
	rule: {
		width: StyleSheet.hairlineWidth,
		height: 22,
		flexShrink: 0,
		backgroundColor: colors.border,
	},
	segments: {
		flexDirection: "row",
		flexShrink: 0,
		alignItems: "center",
		gap: 2,
	},
	segment: {
		height: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		borderRadius: radii.small,
	},
	segmentHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	segmentPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	segmentLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	segmentLabelChosen: {
		color: colors.onHighlight,
	},
	action: {
		height: 44,
		flexDirection: "row",
		flexShrink: 0,
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		borderRadius: radii.small,
	},
	actionLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	actionInactive: {
		opacity: 0.4,
	},
});
