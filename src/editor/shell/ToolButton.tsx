import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
	Children,
	type ComponentProps,
	createContext,
	isValidElement,
	type ReactNode,
	type RefObject,
	useContext,
	useState,
} from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import { compactControls } from "@/ui/density";
import { Highlight } from "@/ui/Highlight";
import { chosenOnWeb, interaction, pressAtOnce } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";

// A tool's narrowest width, and the space a row of them leaves between them
// and at its ends while they fit.
const TOOL_WIDTH = 56;
const ROW_GAP = 12;

// Whether tools stand in a column, whose tooltips go beside them rather than
// over the next one down.
const InRail = createContext(false);

// Tools use MaterialCommunityIcons (photo-editor glyphs like format-text, crop,
// blur); small inline actions use Ionicons via IconButton.
type ToolIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * An editing tool in the dock: an icon with a label under it, and no tile
 * around it until it's hovered or pressed. The tool in use is highlighted.
 * `busy` swaps the icon for a spinner while the tool's work runs, and blocks
 * a second press meanwhile. With a `shortcut`, web shows it on hover.
 * `selected` marks the tool in use with the highlighter. `marked` is the
 * rail's open tool: the same bold label, without the highlighter, and still
 * selected to a screen reader. `open` is a button whose tray is open, by its
 * label alone, so only one thing is highlighted. `glyph`, when
 * given, is drawn in place of the icon (which still names the tool to the
 * type checker). In a `ToolGrid`, it's drawn a little smaller, to fit two
 * rows in the dock, and in the rail smaller still where controls are sized
 * for a mouse.
 */
export function ToolButton({
	label,
	icon,
	glyph,
	shortcut,
	tone = "default",
	disabled = false,
	selected,
	marked,
	open = false,
	busy = false,
	compact = false,
	buttonRef,
	onPress,
}: {
	label: string;
	icon: ToolIconName;
	glyph?: ReactNode;
	shortcut?: string;
	tone?: "default" | "danger";
	disabled?: boolean;
	selected?: boolean;
	marked?: boolean;
	open?: boolean;
	busy?: boolean;
	compact?: boolean;
	// The pressable, when a popover hangs from this button.
	buttonRef?: RefObject<ViewInstance | null>;
	onPress: () => void;
}) {
	const inRail = useContext(InRail);
	const small = inRail && compactControls;
	const { anchor, tooltip } = useTooltip(
		label,
		shortcut,
		inRail ? "right" : "below",
	);
	const inactive = disabled || busy;
	const danger = tone === "danger";
	// The highlighter; a marked tool is chosen without it.
	const highlighted = !!selected && !marked;
	const chosen = !!selected || !!marked;
	const ink = danger
		? colors.danger
		: highlighted
			? colors.onHighlight
			: colors.textPrimary;
	return (
		<>
			<Pressable
				{...(shortcut ? anchor : undefined)}
				// The tooltip's anchor and a popover's share this pressable.
				ref={(node: ViewInstance | null) => {
					if (shortcut && anchor.ref) anchor.ref.current = node;
					if (buttonRef) buttonRef.current = node;
				}}
				{...pressAtOnce}
				hitSlop={8}
				disabled={inactive}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{
					disabled: inactive,
					busy,
					selected: chosen,
					expanded: open,
				}}
				{...chosenOnWeb(
					selected === undefined && marked === undefined ? undefined : chosen,
				)}
				style={[
					styles.container,
					compact && styles.compact,
					small && styles.small,
					disabled && styles.disabled,
				]}
			>
				{(state) => {
					const { pressed, hovered } = interaction(state);
					const lit = !inactive && (hovered || pressed);
					return (
						<>
							{highlighted && <Highlight style={styles.highlight} />}
							<View
								style={[
									styles.tile,
									compact && styles.compactTile,
									small && styles.smallTile,
									webTransition,
									lit && (danger ? styles.tileDanger : styles.tileHovered),
									!inactive && pressed && styles.tilePressed,
								]}
							>
								{busy ? (
									<ActivityIndicator color={ink} />
								) : (
									(glyph ?? (
										<MaterialCommunityIcons
											name={icon}
											size={small ? 20 : 24}
											color={ink}
										/>
									))
								)}
							</View>
							<Text
								style={[
									styles.label,
									small && styles.smallLabel,
									highlighted && styles.labelSelected,
									(open || marked) && styles.labelOpen,
								]}
							>
								{label}
							</Text>
						</>
					);
				}}
			</Pressable>
			{shortcut && tooltip}
		</>
	);
}

/**
 * The main tools in two rows, balanced (five over four, four over three,
 * three over three), so all of them show on a phone at once. Its
 * `ToolButton`s are `compact`.
 */
export function ToolGrid({ children }: { children: ReactNode }) {
	const tools = Children.toArray(children);
	const columns = Math.min(5, Math.ceil(tools.length / 2));
	return (
		<View style={styles.grid}>
			{tools.map((tool) => (
				<View
					key={isValidElement(tool) ? tool.key : null}
					style={[styles.cell, { width: `${100 / columns}%` }]}
				>
					{tool}
				</View>
			))}
		</View>
	);
}

/**
 * A dock panel's row of `ToolButton`s, centered while they fit. On a narrow
 * screen the space between them shrinks to fit them all, and only once
 * there's none left does the row scroll sideways. `vertical` stacks them in
 * a column instead, for a wide screen's tool rail.
 */
export function ToolRow({
	vertical = false,
	children,
}: {
	vertical?: boolean;
	children: ReactNode;
}) {
	const [width, setWidth] = useState(0);
	if (vertical) {
		return (
			<InRail.Provider value={true}>
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.column}
				>
					{children}
				</ScrollView>
			</InRail.Provider>
		);
	}
	const count = Children.toArray(children).length;
	// Gaps between the tools, and one at each end. Until the row is measured,
	// it's laid out as though they fit.
	const spacing = ROW_GAP * (count + 1);
	const fit =
		width > 0
			? Math.min(1, Math.max(0, (width - count * TOOL_WIDTH) / spacing))
			: 1;
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={styles.rowScroll}
			contentContainerStyle={[
				styles.row,
				{ gap: ROW_GAP * fit, paddingHorizontal: ROW_GAP * fit },
			]}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{children}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	rowScroll: {
		flex: 1,
	},
	// Closer together where controls are sized for a mouse.
	column: {
		alignItems: "center",
		gap: compactControls ? space.xs : ROW_GAP,
		paddingVertical: compactControls ? space.xs : ROW_GAP,
	},
	// Grows to fill the panel rather than flexing, which would hold it to the
	// panel's width, so it never scrolls.
	row: {
		flexGrow: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		minWidth: TOOL_WIDTH,
		alignItems: "center",
		gap: 6,
	},
	compact: {
		gap: 2,
	},
	small: {
		minWidth: 52,
		gap: 2,
	},
	grid: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		alignContent: "center",
		rowGap: 6,
		paddingHorizontal: 8,
	},
	cell: {
		alignItems: "center",
	},
	// Down past the label's descenders.
	highlight: {
		bottom: -4,
	},
	disabled: {
		opacity: 0.35,
	},
	tile: {
		width: 48,
		height: 48,
		borderRadius: radii.small,
		borderCurve: "continuous",
		alignItems: "center",
		justifyContent: "center",
	},
	tileHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	tileDanger: {
		backgroundColor: colors.dangerSoft,
	},
	compactTile: {
		width: 44,
		height: 44,
	},
	smallTile: {
		width: 36,
		height: 36,
	},
	tilePressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	label: {
		...typography.caption,
		letterSpacing: 0.1,
		color: colors.textPrimary,
		textAlign: "center",
	},
	smallLabel: {
		fontSize: 11,
	},
	labelSelected: {
		color: colors.onHighlight,
	},
	labelOpen: {
		fontWeight: "700",
	},
});
