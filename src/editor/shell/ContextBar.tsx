import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
	Children,
	type ComponentProps,
	createContext,
	Fragment,
	isValidElement,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	type StyleProp,
	StyleSheet,
	Text,
	type TextStyle,
	View,
} from "react-native";
import { compactControls } from "@/ui/density";
import { fadeTo } from "@/ui/gradient";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import {
	fadeCut,
	fadeCutLeft,
	type ItemBox,
	leafEdges,
	rowEdges,
} from "./barFade";
import { ModeActions } from "./Dock";

// How wide the fade is. On either side it ends on the first option that
// doesn't fit whole, so the edge falls between options instead of across a label.
const FADE_WIDTH = 32;
// Long enough that a drag's scroll events, throttled below, don't each move
// the fade: it settles once they stop.
const FADE_SETTLE_MS = 120;
// A segment's, an action's, and a chip's height: a touch target, or less
// where controls are sized for a mouse.
const ITEM_HEIGHT = compactControls ? 36 : 44;

// Item positions, in a group's coordinates or a parent item's, so the fade
// can add them up to a position in the scrolling row.
type BarMetricsApi = {
	reportGroup: (id: string, x: number) => void;
	reportItem: (id: string, parent: string, x: number, width: number) => void;
	forgetGroup: (id: string) => void;
	forgetItem: (id: string) => void;
};

const BarMetrics = createContext<BarMetricsApi | null>(null);
// The group, or the measured option, this control is laid out in.
const BarParent = createContext<string | null>(null);

function near(a: number, b: number) {
	return Math.abs(a - b) < 0.5;
}

/**
 * One measured option. Its `onLayout` x is relative to its parent, and nested
 * options (a segment inside a segmented control) report through `BarParent`,
 * so a box that only wraps other options isn't where the fade stops.
 */
function MeasuredItem({ children }: { children: ReactNode }) {
	const metrics = useContext(BarMetrics);
	const parent = useContext(BarParent);
	const id = useId();
	useEffect(() => () => metrics?.forgetItem(id), [metrics, id]);
	return (
		<BarParent.Provider value={id}>
			<View
				collapsable={false}
				style={styles.item}
				onLayout={(event) => {
					if (!parent) return;
					const { x, width } = event.nativeEvent.layout;
					metrics?.reportItem(id, parent, x, width);
				}}
			>
				{children}
			</View>
		</BarParent.Provider>
	);
}

/**
 * The wide editor's header, between Back and the header's actions: the
 * context's name, its options, then Cancel and Done. A divider sets those
 * off from Reset, undo, and Export. It's a toolbar for screen readers.
 * - Options arrive as `BarSections`: groups 2 points apart, a rule between
 *   groups. The highlighter marks the mode. A value is a `BarChip`.
 * - The row scrolls when it doesn't fit. The fade ends between options,
 *   rather than across a label, and settles once scrolling stops.
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
	const metrics = useContext(BarMetrics);
	const groupId = useId();
	const items = Children.toArray(children);
	useEffect(() => () => metrics?.forgetGroup(groupId), [metrics, groupId]);
	if (items.length === 0) return null;
	return (
		<BarParent.Provider value={groupId}>
			<View
				style={styles.group}
				onLayout={(event) =>
					metrics?.reportGroup(groupId, event.nativeEvent.layout.x)
				}
			>
				{items.map((item) => (
					<MeasuredItem key={isValidElement(item) ? item.key : "item"}>
						{item}
					</MeasuredItem>
				))}
			</View>
		</BarParent.Provider>
	);
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
	const ownRef = useRef<View>(null);
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
				<BarParent.Provider value={null}>
					{typeof children === "function" ? children(close) : children}
				</BarParent.Provider>
			</Popover>
		</>
	);
}

function ScrollFade({ children }: { children: ReactNode }) {
	const [width, setWidth] = useState(0);
	const [contentWidth, setContentWidth] = useState(0);
	const [offset, setOffset] = useState(0);
	const [groups, setGroups] = useState<Record<string, number>>({});
	const [items, setItems] = useState<Record<string, ItemBox>>({});
	const offsetRef = useRef(0);
	const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (settle.current) clearTimeout(settle.current);
		},
		[],
	);
	const metrics = useMemo<BarMetricsApi>(
		() => ({
			reportGroup(id, x) {
				setGroups((prev) =>
					near(prev[id] ?? Number.NaN, x) ? prev : { ...prev, [id]: x },
				);
			},
			reportItem(id, parent, x, width) {
				if (width <= 0) return;
				setItems((prev) => {
					const current = prev[id];
					if (
						current &&
						current.parent === parent &&
						near(current.x, x) &&
						near(current.width, width)
					) {
						return prev;
					}
					return { ...prev, [id]: { parent, x, width } };
				});
			},
			forgetGroup(id) {
				setGroups((prev) => {
					if (!(id in prev)) return prev;
					const next = { ...prev };
					delete next[id];
					return next;
				});
			},
			forgetItem(id) {
				setItems((prev) => {
					if (!(id in prev)) return prev;
					const next = { ...prev };
					delete next[id];
					return next;
				});
			},
		}),
		[],
	);
	const leaves = leafEdges(rowEdges(groups, items));
	const visibleRight = offset + width;
	const cut = fadeCut(leaves, visibleRight);
	const cutLeft = fadeCutLeft(leaves, offset);
	const overflows = contentWidth - offset - width > 1;
	return (
		<BarMetrics.Provider value={metrics}>
			<View style={styles.scroll}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.scrollContent}
					scrollEventThrottle={32}
					onLayout={(event) => {
						const next = event.nativeEvent.layout.width;
						setWidth((prev) => (near(prev, next) ? prev : next));
					}}
					onContentSizeChange={(next) =>
						setContentWidth((prev) => (near(prev, next) ? prev : next))
					}
					onScroll={(event) => {
						offsetRef.current = event.nativeEvent.contentOffset.x;
						if (settle.current) clearTimeout(settle.current);
						settle.current = setTimeout(() => {
							const x = offsetRef.current;
							setOffset((prev) => (near(prev, x) ? prev : x));
						}, FADE_SETTLE_MS);
					}}
				>
					{children}
				</ScrollView>
				{(cut != null || cutLeft != null) && (
					<View pointerEvents="none" style={styles.overlay}>
						{cutLeft != null && (
							<>
								<View style={[styles.coverLeft, { width: cutLeft - offset }]} />
								<View style={[styles.fadeLeft, { left: cutLeft - offset }]} />
							</>
						)}
						{cut != null && (
							<>
								<View
									style={[styles.fade, { left: cut - offset - FADE_WIDTH }]}
								/>
								<View style={[styles.cover, { left: cut - offset }]} />
							</>
						)}
					</View>
				)}
				{cut == null && cutLeft == null && overflows && leaves.length === 0 && (
					<View pointerEvents="none" style={styles.fadeEnd} />
				)}
			</View>
		</BarMetrics.Provider>
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
		overflow: "hidden",
	},
	scrollContent: {
		flexDirection: "row",
		alignItems: "center",
	},
	overlay: {
		...StyleSheet.absoluteFill,
	},
	fade: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: FADE_WIDTH,
		...fadeTo("right", colors.background),
	},
	fadeLeft: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: FADE_WIDTH,
		...fadeTo("left", colors.background),
	},
	coverLeft: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
		backgroundColor: colors.background,
	},
	fadeEnd: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 0,
		width: FADE_WIDTH,
		...fadeTo("right", colors.background),
	},
	cover: {
		position: "absolute",
		top: 0,
		bottom: 0,
		right: 0,
		backgroundColor: colors.background,
	},
	item: {
		flexShrink: 0,
	},
	divider: {
		width: StyleSheet.hairlineWidth,
		alignSelf: "stretch",
		flexShrink: 0,
		marginVertical: 14,
		marginLeft: space.xs,
		backgroundColor: colors.border,
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
