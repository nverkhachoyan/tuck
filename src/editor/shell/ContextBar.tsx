import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
	Children,
	type ComponentProps,
	Fragment,
	isValidElement,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	type StyleProp,
	StyleSheet,
	Text,
	type TextStyle,
	View,
	type ViewInstance,
} from "react-native";
import { compactControls } from "@/ui/density";
import { FadeGroup, FadeRow, MeasuredItem, Unmeasured } from "@/ui/FadeRow";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { TextButton } from "@/ui/TextButton";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";

// A segment's, an action's, and a chip's height: a touch target, or less
// where controls are sized for a mouse.
const ITEM_HEIGHT = compactControls ? 36 : 44;
const ACTION_BUTTON_SIZE = compactControls ? 32 : 36;

/**
 * The wide editor's header, between Back and the header's actions: the
 * context's name, its options, then Cancel and Done. A divider sets those
 * off from undo, redo, and Export.
 */
export function ContextBar({
	title,
	onReset,
	onCancel,
	cancelShortcut = "Escape",
	onDone,
	doneLabel = "Done",
	doneShortcut = "Enter",
	keepFocus = false,
	children,
}: {
	title: string;
	onReset?: () => void;
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
	const barRef = useRef<ViewInstance>(null);
	useEffect(() => {
		if (!keepFocus || Platform.OS !== "web") return;
		const node = barRef.current as unknown as HTMLElement | null;
		const keep = (event: MouseEvent) => event.preventDefault();
		node?.addEventListener("mousedown", keep, true);
		return () => node?.removeEventListener("mousedown", keep, true);
	}, [keepFocus]);

	const isDoneWord = !doneLabel || doneLabel === "Done";

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
			<FadeRow style={styles.scroll} contentStyle={styles.scrollContent}>
				{children}
			</FadeRow>
			<View style={styles.actions}>
				{onReset && <TextButton label="Reset" onPress={onReset} />}
				{onCancel && (
					<BarActionButton
						icon="close-outline"
						label="Cancel"
						shortcut={cancelShortcut}
						onPress={onCancel}
					/>
				)}
				{isDoneWord ? (
					<BarActionButton
						icon="checkmark-outline"
						label={doneLabel}
						shortcut={doneShortcut}
						onPress={onDone}
					/>
				) : (
					<TextButton
						label={doneLabel}
						shortcut={doneShortcut}
						onPress={onDone}
					/>
				)}
			</View>
			<View style={styles.divider} />
		</View>
	);
}

function BarActionButton({
	icon,
	label,
	shortcut,
	onPress,
}: {
	icon: ComponentProps<typeof Ionicons>["name"];
	label: string;
	shortcut?: string;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	return (
		<>
			<Pressable
				{...anchor}
				hitSlop={6}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.barActionButton,
						webTransition,
						hovered && styles.segmentHovered,
						pressed && styles.segmentPressed,
					];
				}}
			>
				<Ionicons name={icon} size={20} color={colors.textPrimary} />
			</Pressable>
			{tooltip}
		</>
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
 * icon is the same glyph the dock uses for that mode. `iconsOnly` drops the
 * name, for alignment. `label` names the group for screen readers.
 */
export function OptionSegments({
	label,
	options,
	selected,
	iconsOnly = false,
	onSelect,
}: {
	label: string;
	options: readonly SegmentOption[];
	selected: number;
	// Alignment is the one control that stays icons, since left, center, and
	// right mean the same thing without their names.
	iconsOnly?: boolean;
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
					<MeasuredItem key={option.title}>
						<Pressable
							accessibilityRole="radio"
							accessibilityLabel={option.title}
							accessibilityState={{ checked: chosen, busy, disabled: busy }}
							aria-checked={chosen}
							disabled={busy}
							onPress={() => onSelect(index)}
							style={(state) => {
								const { pressed, hovered } = interaction(state);
								return [
									styles.segment,
									iconsOnly && styles.segmentIcon,
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
									{!iconsOnly && (
										<Text
											style={[
												styles.segmentLabel,
												chosen && styles.segmentLabelChosen,
											]}
										>
											{option.title}
										</Text>
									)}
								</>
							)}
						</Pressable>
					</MeasuredItem>
				);
			})}
		</View>
	);
}

/**
 * A row of the bar's options, 2 points apart. `BarSections` draws the rule
 * between one group and the next, so a tool never places a divider itself.
 * Each option is measured, including the segments of an `OptionSegments`,
 * so the fade can stop between them.
 */
export function BarGroup({ children }: { children: ReactNode }) {
	return <FadeGroup style={styles.group}>{children}</FadeGroup>;
}

/**
 * The bar's groups in a row. A rule separates each one from the next: 1 point
 * of `colors.borderStrong`, 24 tall, with 10 points on either side.
 */
export function BarSections({ children }: { children: ReactNode }) {
	const groups = Children.toArray(children);
	return (
		<>
			{groups.map((group, index) => (
				<Fragment key={isValidElement(group) ? group.key : "group"}>
					{index > 0 && <View style={styles.rule} />}
					{group}
				</Fragment>
			))}
		</>
	);
}

/**
 * A labeled action in the bar, as tall as a segment, beside the segmented
 * sub-tools.
 * - `busy` swaps its icon for a spinner and ignores presses, as a tool button does.
 * - `checked` makes it a switch. The glyph shows the box; the highlighter
 *   stays on the mode.
 */
export function BarButton({
	label,
	icon,
	shortcut,
	busy = false,
	disabled = false,
	checked,
	onPress,
}: {
	label: string;
	icon: BarIcon;
	shortcut?: string;
	busy?: boolean;
	disabled?: boolean;
	checked?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const inactive = busy || disabled;
	const toggle = checked !== undefined;
	return (
		<>
			<Pressable
				{...anchor}
				accessibilityRole={toggle ? "switch" : "button"}
				accessibilityLabel={label}
				accessibilityState={{
					disabled: inactive,
					busy,
					checked: toggle ? checked : undefined,
				}}
				// React Native Web ignores `accessibilityState.checked`.
				aria-checked={toggle ? checked : undefined}
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
						size={18}
						color={colors.textPrimary}
					/>
				)}
				<Text style={styles.actionLabel}>{label}</Text>
			</Pressable>
			{tooltip}
		</>
	);
}

/**
 * An option that shows its current value and opens the choices in a popover.
 * The bar's highlighter is for the mode; a chip is how a value is changed.
 * `label` is for screen readers, `text` is what's drawn beside the glyph.
 * `children` can take `close`, for a choice that's complete once made: the
 * popover is modal, so left open it would take the next press on the canvas.
 */
export function BarChip({
	label,
	icon,
	glyph,
	text,
	shortcut,
	textStyle,
	restoreFocus,
	children,
}: {
	label: string;
	icon?: BarIcon;
	glyph?: ReactNode;
	text: string;
	shortcut?: string;
	// The font chip draws its name in the font it sets.
	textStyle?: StyleProp<TextStyle>;
	restoreFocus?: () => void;
	children: ReactNode | ((close: () => void) => ReactNode);
}) {
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);
	const ownRef = useRef<ViewInstance>(null);
	const { anchor, tooltip } = useTooltip(label, shortcut);
	const ref = anchor.ref ?? ownRef;
	return (
		<>
			<Pressable
				{...anchor}
				ref={ref}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ expanded: open }}
				aria-expanded={open}
				onPress={() => setOpen((shown) => !shown)}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.action,
						webTransition,
						hovered && styles.segmentHovered,
						pressed && styles.segmentPressed,
					];
				}}
			>
				{glyph ??
					(icon && (
						<MaterialCommunityIcons
							name={icon}
							size={18}
							color={colors.textPrimary}
						/>
					))}
				<Text style={[styles.actionLabel, textStyle]}>{text}</Text>
				<MaterialCommunityIcons
					name="chevron-down"
					size={18}
					color={colors.textPrimary}
				/>
			</Pressable>
			{tooltip}
			<Popover
				anchor={ref}
				open={open}
				onClose={close}
				label={label}
				restoreFocus={restoreFocus}
			>
				{/* Choices aren't options in the row. Measuring them would
				    place the fade on controls that aren't in the bar. */}
				<Unmeasured>
					{typeof children === "function" ? children(close) : children}
				</Unmeasured>
			</Popover>
		</>
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
	},
	scrollContent: {
		flexDirection: "row",
		alignItems: "center",
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 0,
		gap: 6,
		marginLeft: space.xs,
	},
	barActionButton: {
		width: ACTION_BUTTON_SIZE,
		height: ACTION_BUTTON_SIZE,
		borderRadius: ACTION_BUTTON_SIZE / 2,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	divider: {
		width: StyleSheet.hairlineWidth,
		height: 24,
		alignSelf: "center",
		flexShrink: 0,
		marginHorizontal: 12,
		backgroundColor: colors.borderStrong,
	},
	group: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 0,
		gap: 2,
	},
	rule: {
		width: 1,
		height: 24,
		flexShrink: 0,
		marginHorizontal: 10,
		backgroundColor: colors.borderStrong,
	},
	segments: {
		flexDirection: "row",
		flexShrink: 0,
		alignItems: "center",
		gap: 2,
	},
	segment: {
		height: ITEM_HEIGHT,
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
	segmentIcon: {
		width: ITEM_HEIGHT,
		paddingHorizontal: 0,
		justifyContent: "center",
	},
	segmentLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	segmentLabelChosen: {
		color: colors.onHighlight,
	},
	action: {
		height: ITEM_HEIGHT,
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
