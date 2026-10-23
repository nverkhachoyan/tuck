import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, type RefObject, useMemo, useState } from "react";
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
	type ScrollView,
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
import type { Layer, RedactionEffect } from "@/model/document";
import { IconButton } from "@/ui/IconButton";
import { colors, radii, typography } from "@/ui/theme";
import { SHAPE_ICONS, SHAPE_NAMES } from "../../shell/shapeIcons";
import { dragRow, layerIndexForSlot, moveItem } from "./layerReorder";

export const ROW_HEIGHT = 52;
const SETTLE = { duration: 160 };

export type LayerRowActions = {
	onSelect: (id: string) => void;
	onMove: (id: string, toIndex: number) => void;
	onSetHidden: (id: string, hidden: boolean) => void;
	onSetLocked: (id: string, locked: boolean) => void;
	onDelete: (id: string) => void;
};

export function LayerRow({
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
	staticRow = false,
}: {
	layer: Layer;
	slot: number;
	count: number;
	order: SharedValue<string[]>;
	dragId: SharedValue<string | null>;
	scrollRef: RefObject<ScrollView | null>;
	selected: boolean;
	compact: boolean;
	/** A group-expanded list keeps its rows in normal flow, not drag slots. */
	staticRow?: boolean;
} & LayerRowActions) {
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
					? colors.selectionSoft
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
				!staticRow && styles.stackedRow,
				selected && styles.rowSelected,
				!staticRow && position,
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
			{staticRow ? null : (
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
			)}
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
		case "redaction":
			return <IconThumbnail icon={REDACTION_ICONS[layer.effect.type]} />;
		case "shape":
			return <IconThumbnail icon={SHAPE_ICONS[layer.shape]} />;
		default:
			return assertNever(layer);
	}
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const REDACTION_ICONS: Record<RedactionEffect["type"], IconName> = {
	solid: "square-rounded",
	blur: "blur",
	pixelate: "checkerboard",
};

const REDACTION_LABELS: Record<RedactionEffect["type"], string> = {
	solid: "Redaction",
	blur: "Blur",
	pixelate: "Pixelate",
};

function IconThumbnail({ icon }: { icon: IconName }) {
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
	return layer.type === "text"
		? layer.text.replace(/\s+/g, " ")
		: layerKindName(layer);
}

/** What kind of layer `layer` is, as the selection's footer names it. */
export function layerKindName(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return layer.sticker ? "Sticker" : "Photo";
		case "text":
			return "Text";
		case "drawing":
			return "Drawing";
		case "redaction":
			return REDACTION_LABELS[layer.effect.type];
		case "shape":
			return SHAPE_NAMES[layer.shape];
		default:
			return assertNever(layer);
	}
}

const handleCursor =
	Platform.OS === "web" ? ({ cursor: "grab" } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
	row: {
		height: ROW_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		marginHorizontal: 8,
		paddingLeft: 12,
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: "transparent",
	},
	stackedRow: {
		position: "absolute",
		left: 0,
		right: 0,
	},
	rowSelected: {
		borderColor: colors.selectionBorder,
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
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surfaceHover,
	},
	label: {
		...typography.body,
		flex: 1,
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
	trailing: {
		width: 60,
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "center",
	},
	compactTrailing: {
		width: 44,
	},
});
