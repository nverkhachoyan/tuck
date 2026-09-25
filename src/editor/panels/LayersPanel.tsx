import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
	type ComponentProps,
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type AccessibilityActionEvent,
	Image,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import {
	Gesture,
	GestureDetector,
	type PanGesture,
	ScrollView,
} from "react-native-gesture-handler";
import Animated, {
	Easing,
	FadeInRight,
	FadeOutRight,
	type SharedValue,
	SlideInDown,
	SlideOutDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { assertNever } from "@/lib/assertNever";
import { hapticTick } from "@/lib/haptics";
import type { Layer } from "@/model/document";
import { colors, radii } from "@/theme";
import { IconButton } from "@/ui/IconButton";
import { BackgroundPicker } from "../BackgroundPicker";
import { dragRow, layerIndexForSlot, moveItem } from "./layerReorder";

const ROW_HEIGHT = 52;
const SETTLE = { duration: 160 };
const SIDEBAR_WIDTH = 340;
const SIDEBAR_MARGIN = 12;
// `webTransition`'s curve, for arriving, and its mirror for leaving.
const DECELERATE = Easing.bezier(0.2, 0, 0, 1);
const ACCELERATE = Easing.bezier(0.3, 0, 1, 1);
const SHEET_IN = SlideInDown.duration(280).easing(DECELERATE);
const SHEET_OUT = SlideOutDown.duration(200).easing(ACCELERATE);
const SIDEBAR_IN = FadeInRight.duration(200).easing(DECELERATE);
const SIDEBAR_OUT = FadeOutRight.duration(150).easing(ACCELERATE);
// A released sheet closes if its drag, carried on at the release speed for
// this long (in seconds), would pass a third of its height.
const SWIPE_MOMENTUM = 0.15;
const SWIPE_SETTLE = { duration: 200, easing: DECELERATE };

// How far from the right an overlay beside the open sidebar should stop.
export const LAYERS_SIDEBAR_INSET = SIDEBAR_WIDTH + SIDEBAR_MARGIN * 2;

type LayerListProps = {
	layers: Layer[];
	background: string | null;
	selectedLayerId: string | null;
	onSelect: (id: string) => void;
	onMove: (id: string, toIndex: number) => void;
	onSetHidden: (id: string, hidden: boolean) => void;
	onSetLocked: (id: string, locked: boolean) => void;
	onDelete: (id: string) => void;
	onSetBackground: (background: string | null) => void;
};

/**
 * The layers list in a card floating over its parent, so opening it never
 * resizes the canvas, which stays usable around it. A "sidebar" sits at the
 * top right; a "sheet" along the bottom, up to half the parent's height.
 *
 * Stays mounted while closed, so the card can animate out. The area around
 * the card is a plain View because `box-none` needs a class on web, and an
 * animated view's style goes inline there.
 */
export function LayersPanel({
	layout,
	open,
	onClose,
	...list
}: LayerListProps & {
	layout: "sidebar" | "sheet";
	open: boolean;
	onClose: () => void;
}) {
	if (layout === "sheet") {
		return (
			<View style={styles.sheetArea}>
				{open && (
					<LayersSheet onClose={onClose}>
						<LayerList {...list} compact={false} />
					</LayersSheet>
				)}
			</View>
		);
	}
	return (
		<View style={styles.sidebarArea}>
			{open && (
				<Animated.View
					entering={SIDEBAR_IN}
					exiting={SIDEBAR_OUT}
					style={[styles.card, styles.sidebar]}
				>
					<PanelHeader onClose={onClose} />
					<LayerList {...list} compact />
				</Animated.View>
			)}
		</View>
	);
}

/**
 * The panel as a sheet, which its header drags down: released, it closes or
 * settles back. The card moves inside the view that slides it in and out, so
 * the two animations don't fight over one transform, and once swiped away,
 * the exit slide runs out of sight.
 */
function LayersSheet({
	onClose,
	children,
}: {
	onClose: () => void;
	children: ReactNode;
}) {
	const { bottom } = useSafeAreaInsets();
	const drag = useSharedValue(0);
	const height = useSharedValue(0);

	const swipe = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetY([-8, 8])
				.onUpdate((event) => {
					drag.value = Math.max(0, event.translationY);
				})
				.onEnd((event, success) => {
					const coast = event.translationY + event.velocityY * SWIPE_MOMENTUM;
					if (success && coast > height.value / 3) {
						drag.value = withTiming(
							Math.max(drag.value, height.value),
							SWIPE_SETTLE,
							(finished) => {
								if (finished) scheduleOnRN(onClose);
							},
						);
					} else {
						drag.value = withTiming(0, SWIPE_SETTLE);
					}
				}),
		[drag, height, onClose],
	);
	const dragged = useAnimatedStyle(() => ({
		transform: [{ translateY: drag.value }],
	}));

	return (
		<Animated.View
			entering={SHEET_IN}
			exiting={SHEET_OUT}
			style={styles.sheetSlot}
		>
			<Animated.View
				onLayout={(event) => {
					height.value = event.nativeEvent.layout.height;
				}}
				style={[styles.card, styles.sheet, { paddingBottom: bottom }, dragged]}
			>
				<PanelHeader onClose={onClose} swipe={swipe} />
				{children}
			</Animated.View>
		</Animated.View>
	);
}

/** The panel's title and close button, with a grabber when it can be swiped. */
function PanelHeader({
	onClose,
	swipe,
}: {
	onClose: () => void;
	swipe?: PanGesture;
}) {
	const header = (
		<View style={[styles.column, styles.header, swipe && handleCursor]}>
			{swipe && <View style={styles.grabber} />}
			<Text style={styles.title} accessibilityRole="header">
				Layers
			</Text>
			<IconButton icon="close" label="Close layers" onPress={onClose} />
		</View>
	);
	return swipe ? (
		<GestureDetector gesture={swipe}>{header}</GestureDetector>
	) : (
		header
	);
}

/**
 * The document's layers, top first, with the canvas's background under them.
 * Tapping a row selects its layer, unless it's hidden or locked; dragging its
 * handle reorders it. `compact` rows space their controls for a pointer
 * rather than a finger.
 *
 * Rows sit at absolute positions taken from `order`, the UI thread's copy of
 * the row order. A drag rearranges `order` as it goes, so the other rows
 * slide aside without React rendering, and the document is only reordered
 * once, when the drag ends.
 */
function LayerList({
	layers,
	background,
	selectedLayerId,
	onSelect,
	onMove,
	onSetHidden,
	onSetLocked,
	onDelete,
	onSetBackground,
	compact,
}: LayerListProps & { compact: boolean }) {
	const rows = useMemo(() => layers.slice().reverse(), [layers]);
	const order = useSharedValue(rows.map((layer) => layer.id));
	const dragId = useSharedValue<string | null>(null);
	const scrollRef = useRef<ScrollView>(null);

	useLayoutEffect(() => {
		order.value = rows.map((layer) => layer.id);
	}, [order, rows]);

	return (
		<ScrollView
			ref={scrollRef}
			contentContainerStyle={[styles.column, styles.content]}
		>
			<View style={{ height: rows.length * ROW_HEIGHT }}>
				{rows.map((layer, slot) => (
					<LayerRow
						key={layer.id}
						layer={layer}
						slot={slot}
						count={rows.length}
						order={order}
						dragId={dragId}
						scrollRef={scrollRef}
						selected={layer.id === selectedLayerId}
						compact={compact}
						onSelect={onSelect}
						onMove={onMove}
						onSetHidden={onSetHidden}
						onSetLocked={onSetLocked}
						onDelete={onDelete}
					/>
				))}
			</View>
			{rows.length === 0 && (
				<Text style={styles.empty}>
					Text, drawings, and photos you add appear here.
				</Text>
			)}
			<View style={styles.row}>
				<Text style={styles.label}>Background</Text>
				<BackgroundPicker value={background} onPick={onSetBackground} />
			</View>
		</ScrollView>
	);
}

function LayerRow({
	layer,
	slot,
	count,
	order,
	dragId,
	scrollRef,
	selected,
	compact,
	onSelect,
	onMove,
	onSetHidden,
	onSetLocked,
	onDelete,
}: {
	layer: Layer;
	slot: number;
	count: number;
	order: SharedValue<string[]>;
	dragId: SharedValue<string | null>;
	scrollRef: RefObject<ScrollView | null>;
	selected: boolean;
	compact: boolean;
} & Pick<
	LayerListProps,
	"onSelect" | "onMove" | "onSetHidden" | "onSetLocked" | "onDelete"
>) {
	const { id, hidden, locked } = layer;
	const label = layerLabel(layer);
	const startSlot = useSharedValue(0);
	const dragTop = useSharedValue(0);
	// A mouse over the row, on web.
	const [hovered, setHovered] = useState(false);

	// The scroll view waits for the handle, so dragging it never scrolls.
	const pan = useMemo(
		() =>
			Gesture.Pan()
				.minDistance(0)
				.blocksExternalGesture(scrollRef)
				.onStart(() => {
					if (dragId.value !== null) return;
					dragId.value = id;
					startSlot.value = order.value.indexOf(id);
					dragTop.value = startSlot.value * ROW_HEIGHT;
				})
				.onUpdate((event) => {
					if (dragId.value !== id) return;
					const next = dragRow(
						startSlot.value,
						event.translationY,
						ROW_HEIGHT,
						count,
					);
					dragTop.value = next.top;
					const current = order.value.indexOf(id);
					if (next.slot !== current) {
						order.value = moveItem(order.value, current, next.slot);
						scheduleOnRN(hapticTick);
					}
				})
				.onFinalize(() => {
					if (dragId.value !== id) return;
					dragId.value = null;
					const end = order.value.indexOf(id);
					if (end !== startSlot.value) {
						scheduleOnRN(onMove, id, layerIndexForSlot(end, count));
					}
				}),
		[id, count, order, dragId, startSlot, dragTop, scrollRef, onMove],
	);

	const position = useAnimatedStyle(() => {
		const dragging = dragId.value === id;
		const index = order.value.indexOf(id);
		return {
			top: dragging
				? dragTop.value
				: withTiming((index === -1 ? slot : index) * ROW_HEIGHT, SETTLE),
			zIndex: dragging ? 1 : 0,
			backgroundColor: dragging
				? colors.surfacePressed
				: selected
					? colors.accentSoft
					: hovered
						? colors.hoverOverlay
						: "transparent",
			transform: [{ scale: withTiming(dragging ? 1.02 : 1, SETTLE) }],
		};
	}, [id, slot, selected, hovered]);

	const move = (event: AccessibilityActionEvent) => {
		const index = layerIndexForSlot(slot, count);
		onMove(
			id,
			event.nativeEvent.actionName === "moveUp" ? index + 1 : index - 1,
		);
	};

	return (
		<Animated.View
			style={[
				styles.row,
				styles.stackedRow,
				selected && styles.rowSelected,
				position,
			]}
			onPointerEnter={(event) => {
				if (event.nativeEvent.pointerType === "mouse") setHovered(true);
			}}
			onPointerLeave={() => setHovered(false)}
		>
			<Pressable
				style={[styles.main, hidden && styles.dimmed]}
				disabled={hidden || locked}
				onPress={() => onSelect(id)}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ selected, disabled: hidden || locked }}
				accessibilityActions={[
					{ name: "moveUp", label: "Move up" },
					{ name: "moveDown", label: "Move down" },
				]}
				onAccessibilityAction={move}
			>
				<LayerThumbnail layer={layer} />
				<Text style={styles.label} numberOfLines={1}>
					{label}
				</Text>
			</Pressable>
			<View style={[styles.actions, compact && styles.compactActions]}>
				<IconButton
					icon={hidden ? "eye-off-outline" : "eye-outline"}
					label={hidden ? `Show ${label}` : `Hide ${label}`}
					onPress={() => onSetHidden(id, !hidden)}
				/>
				<IconButton
					icon={locked ? "lock-closed-outline" : "lock-open-outline"}
					label={locked ? `Unlock ${label}` : `Lock ${label}`}
					onPress={() => onSetLocked(id, !locked)}
				/>
				<IconButton
					icon="trash-outline"
					label={`Delete ${label}`}
					onPress={() => onDelete(id)}
				/>
			</View>
			<GestureDetector gesture={pan}>
				<View
					style={[
						styles.trailing,
						compact && styles.compactTrailing,
						handleCursor,
					]}
					accessibilityLabel={`Reorder ${label}`}
				>
					<Ionicons
						name="reorder-three-outline"
						size={24}
						color={colors.textSecondary}
					/>
				</View>
			</GestureDetector>
		</Animated.View>
	);
}

function LayerThumbnail({ layer }: { layer: Layer }) {
	switch (layer.type) {
		case "image":
			return <Image source={{ uri: layer.uri }} style={styles.thumbnail} />;
		case "text":
			return <IconThumbnail icon="format-text" />;
		case "drawing":
			return <IconThumbnail icon="draw" />;
		default:
			return assertNever(layer);
	}
}

function IconThumbnail({
	icon,
}: {
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
}) {
	return (
		<View style={styles.thumbnail}>
			<MaterialCommunityIcons
				name={icon}
				size={20}
				color={colors.textPrimary}
			/>
		</View>
	);
}

function layerLabel(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return "Photo";
		case "text":
			return layer.text.replace(/\s+/g, " ");
		case "drawing":
			return "Drawing";
		default:
			return assertNever(layer);
	}
}

const handleCursor =
	Platform.OS === "web" ? ({ cursor: "grab" } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
	sidebarArea: {
		position: "absolute",
		top: SIDEBAR_MARGIN,
		right: SIDEBAR_MARGIN,
		bottom: SIDEBAR_MARGIN,
		width: SIDEBAR_WIDTH,
		pointerEvents: "box-none",
	},
	sheetArea: {
		position: "absolute",
		top: "50%",
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "flex-end",
		pointerEvents: "box-none",
	},
	card: {
		borderWidth: 1,
		borderColor: colors.border,
	},
	// Sized to the list until it fills the area, then scrolls.
	sidebar: {
		maxHeight: "100%",
		borderRadius: radii.large,
		backgroundColor: colors.surface,
		paddingBottom: 4,
		boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
	},
	sheetSlot: {
		maxHeight: "100%",
	},
	sheet: {
		flexShrink: 1,
		borderBottomWidth: 0,
		borderTopLeftRadius: radii.extraLarge,
		borderTopRightRadius: radii.extraLarge,
		backgroundColor: colors.background,
		boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.45)",
	},
	column: {
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
	},
	header: {
		height: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: 20,
		paddingRight: 22,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	grabber: {
		position: "absolute",
		top: 6,
		left: "50%",
		width: 36,
		height: 5,
		marginLeft: -18,
		borderRadius: 2.5,
		backgroundColor: colors.borderStrong,
	},
	title: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	content: {
		paddingVertical: 8,
	},
	row: {
		height: ROW_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		marginHorizontal: 8,
		paddingLeft: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "transparent",
	},
	stackedRow: {
		position: "absolute",
		left: 0,
		right: 0,
	},
	rowSelected: {
		borderColor: colors.accentBorder,
	},
	main: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		alignSelf: "stretch",
	},
	dimmed: {
		opacity: 0.4,
	},
	thumbnail: {
		width: 36,
		height: 36,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.border,
	},
	label: {
		flex: 1,
		fontSize: 15,
		color: colors.textPrimary,
	},
	actions: {
		flexDirection: "row",
		gap: 22,
		paddingLeft: 12,
	},
	compactActions: {
		gap: 14,
	},
	// Wide enough to grab comfortably.
	trailing: {
		width: 60,
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "center",
	},
	compactTrailing: {
		width: 44,
	},
	empty: {
		height: ROW_HEIGHT,
		lineHeight: ROW_HEIGHT,
		paddingHorizontal: 20,
		fontSize: 14,
		color: colors.textSecondary,
	},
});
