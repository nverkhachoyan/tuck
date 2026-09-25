import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
	type ComponentProps,
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
	ScrollView,
} from "react-native-gesture-handler";
import Animated, {
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { assertNever } from "@/lib/assertNever";
import { hapticTick } from "@/lib/haptics";
import type { Layer } from "@/model/document";
import { colors } from "@/theme";
import { IconButton } from "@/ui/IconButton";
import { BackgroundPicker } from "../BackgroundPicker";
import { dragRow, layerIndexForSlot, moveItem } from "./layerReorder";

const ROW_HEIGHT = 52;
const SETTLE = { duration: 160 };

type LayersPanelProps = {
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
 * The document's layers, top first, with the canvas's background under them.
 * Tapping a row selects its layer, unless it's hidden or locked; dragging its
 * handle reorders it.
 *
 * Rows sit at absolute positions taken from `order`, the UI thread's copy of
 * the row order. A drag rearranges `order` as it goes, so the other rows
 * slide aside without React rendering, and the document is only reordered
 * once, when the drag ends.
 */
export function LayersPanel({
	layers,
	background,
	selectedLayerId,
	onSelect,
	onMove,
	onSetHidden,
	onSetLocked,
	onDelete,
	onSetBackground,
}: LayersPanelProps) {
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
			style={styles.scroll}
			contentContainerStyle={styles.content}
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
						onSelect={onSelect}
						onMove={onMove}
						onSetHidden={onSetHidden}
						onSetLocked={onSetLocked}
						onDelete={onDelete}
					/>
				))}
			</View>
			{rows.length === 0 && (
				<Text style={styles.empty}>Text you add appears here.</Text>
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
} & Pick<
	LayersPanelProps,
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
				? colors.surfaceHover
				: selected
					? colors.accentSoft
					: hovered
						? colors.surface
						: colors.background,
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
			<View style={styles.actions}>
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
					style={[styles.trailing, handleCursor]}
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
	scroll: {
		flex: 1,
	},
	content: {
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
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
	// Wide enough to grab comfortably.
	trailing: {
		width: 60,
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "center",
	},
	empty: {
		height: ROW_HEIGHT,
		lineHeight: ROW_HEIGHT,
		paddingHorizontal: 20,
		fontSize: 14,
		color: colors.textSecondary,
	},
});
