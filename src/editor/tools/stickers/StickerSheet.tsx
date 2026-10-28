import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import {
	ActivityIndicator,
	Image,
	type ImageSourcePropType,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { usePreference } from "@/platform/usePreference";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { showAlert } from "@/ui/showAlert";
import { colors, radii, typography, webTransition } from "@/ui/theme";
import { useEditorContext } from "../../editorContext";
import {
	STICKER_CATEGORY_LABELS,
	STICKERS,
	type Sticker,
	type StickerCategory,
	stickerCategories,
} from "./bundledStickers";
import type { ShownSticker } from "./useSavedStickers";
import type { StickersController } from "./useStickersTool";

const TILE = 56;
const GRID_GAP = 4;
const GRID_PADDING = 12;
// Tall enough for five rows of stickers, so switching categories doesn't
// resize the sheet. On a short screen it gives way first.
const GRID_HEIGHT = 5 * (TILE + GRID_GAP) + GRID_PADDING;
// A classic scrollbar takes about this much out of the scroll view. The grid
// measures the width left inside it, so the popover allows for one. An
// overlay scrollbar takes none, and the extra width still holds six tiles.
const SCROLLBAR = 16;

// The person's own stickers come first, then the bundled ones.
type StickerTab = "yours" | StickerCategory;
const stickerTabs: StickerTab[] = ["yours", ...stickerCategories];
const TAB_LABELS: Record<StickerTab, string> = {
	yours: "Yours",
	...STICKER_CATEGORY_LABELS,
};

const parseTab = (saved: unknown): StickerTab =>
	stickerTabs.find((tab) => tab === saved) ?? "faces";

type SavedStickerProps = {
	// Null while they load.
	savedStickers: ShownSticker[] | null;
	savedError: string | null;
	onAddSaved: (sticker: ShownSticker) => void;
	onSaveNew: () => void;
	onDeleteSaved: (sticker: ShownSticker) => void;
};

type StickerContentProps = SavedStickerProps & {
	onAddSticker: (sticker: Sticker) => void;
};

/**
 * Stickers' sheet: the stickers by category, which the editor shows in a
 * bottom sheet on a phone, or in a popover beside the rail's Sticker button
 * on a wide window. There the grid is wide enough for six tiles, and tall
 * enough for five rows.
 */
export function StickerSheet({
	controller,
}: {
	controller: StickersController;
}) {
	const { wide } = useEditorContext();
	const content = <StickerContent {...controller} />;
	return wide ? <View style={styles.popoverBody}>{content}</View> : content;
}

/**
 * The stickers to add, by category, remembering the last one shown.
 * Yours holds the person's own: `onSaveNew` picks an image to keep as one,
 * and a long press (or on web, a hovered delete button) deletes one once
 * confirmed.
 */
function StickerContent({ onAddSticker, ...saved }: StickerContentProps) {
	const [tab, setTab] = usePreference("stickerCategory", parseTab);
	// Measured inside the scroll view, clear of a web scrollbar.
	const [gridWidth, setGridWidth] = useState(0);
	// As many whole tiles as fit across, spread to fill the row.
	const columns = Math.max(
		1,
		Math.floor((gridWidth + GRID_GAP) / (TILE + GRID_GAP)),
	);
	const tileWidth = (gridWidth - GRID_GAP * (columns - 1)) / columns;

	return (
		<>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.chipsScroll}
				contentContainerStyle={styles.chips}
			>
				{stickerTabs.map((each) => (
					<CategoryChip
						key={each}
						label={TAB_LABELS[each]}
						selected={each === tab}
						onPress={() => setTab(each)}
					/>
				))}
			</ScrollView>
			<ScrollView
				key={tab}
				style={styles.gridScroll}
				contentContainerStyle={styles.gridContent}
			>
				<View
					style={styles.grid}
					onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
				>
					{gridWidth > 0 &&
						(tab === "yours" ? (
							<SavedStickers {...saved} tileWidth={tileWidth} />
						) : (
							STICKERS[tab].map((sticker) => (
								<StickerTile
									key={sticker.label}
									label={sticker.label}
									source={sticker.thumbnail}
									width={tileWidth}
									onPress={() => onAddSticker(sticker)}
								/>
							))
						))}
				</View>
			</ScrollView>
		</>
	);
}

function CategoryChip({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={{ top: 8, bottom: 8 }}
			onPress={onPress}
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			aria-selected={selected}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.chip,
					webTransition,
					hovered && styles.chipHovered,
					pressed && styles.pressed,
				];
			}}
		>
			{selected && <Highlight under style={styles.chipUnder} />}
			<Text style={styles.chipLabel}>{label}</Text>
		</Pressable>
	);
}

/**
 * The Yours tab: a tile that makes a new sticker, then the saved ones, with
 * a word on what they are while there are none.
 */
function SavedStickers({
	savedStickers,
	savedError,
	onAddSaved,
	onSaveNew,
	onDeleteSaved,
	tileWidth,
}: SavedStickerProps & { tileWidth: number }) {
	const confirmDelete = (sticker: ShownSticker) =>
		showAlert(
			"Delete sticker?",
			"It's removed from your stickers. Projects that use it keep it.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => onDeleteSaved(sticker),
				},
			],
		);

	return (
		<>
			<Pressable
				onPress={onSaveNew}
				accessibilityRole="button"
				accessibilityLabel="New sticker from an image"
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.tile,
						styles.newTile,
						{ width: tileWidth },
						webTransition,
						hovered && styles.hovered,
						pressed && styles.tilePressed,
					];
				}}
			>
				<MaterialCommunityIcons
					name="plus"
					size={26}
					color={colors.textPrimary}
				/>
			</Pressable>
			{savedStickers === null ? (
				<View style={[styles.tile, { width: tileWidth }]}>
					<ActivityIndicator color={colors.textSecondary} />
				</View>
			) : (
				savedStickers.map((sticker) => (
					<StickerTile
						key={sticker.id}
						label="Your sticker"
						source={{ uri: sticker.url }}
						width={tileWidth}
						onPress={() => onAddSaved(sticker)}
						onDelete={() => confirmDelete(sticker)}
					/>
				))
			)}
			{(savedError || savedStickers?.length === 0) && (
				<Text style={styles.hint}>
					{savedError
						? `Couldn't load your stickers. ${savedError}`
						: "Keep an image you use often as a sticker: add one here, or select a photo on the canvas and tap Sticker."}
				</Text>
			)}
		</>
	);
}

/**
 * A sticker to add. With `onDelete`, a long press deletes it, as does a
 * button a mouse brings up over its corner on web.
 */
function StickerTile({
	label,
	source,
	width,
	onPress,
	onDelete,
}: {
	label: string;
	source: ImageSourcePropType;
	width: number;
	onPress: () => void;
	onDelete?: () => void;
}) {
	// Tracked around the tile and its button together, so moving onto the
	// button doesn't hide it.
	const [pointerOver, setPointerOver] = useState(false);
	return (
		<View
			style={{ width }}
			onPointerEnter={(event) => {
				if (event.nativeEvent.pointerType === "mouse") setPointerOver(true);
			}}
			onPointerLeave={() => setPointerOver(false)}
		>
			<Pressable
				onPress={onPress}
				onLongPress={onDelete}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityActions={
					onDelete ? [{ name: "delete", label: "Delete" }] : undefined
				}
				onAccessibilityAction={(event) => {
					if (event.nativeEvent.actionName === "delete") onDelete?.();
				}}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.tile,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.tilePressed,
					];
				}}
			>
				<Image source={source} resizeMode="contain" style={styles.sticker} />
			</Pressable>
			{onDelete && pointerOver && (
				<Animated.View
					entering={ZoomIn.duration(160)}
					style={styles.deleteBadge}
				>
					<Pressable
						hitSlop={4}
						onPress={onDelete}
						accessibilityRole="button"
						accessibilityLabel="Delete sticker"
						style={(state) => [
							styles.deleteButton,
							webTransition,
							(interaction(state).hovered || state.pressed) &&
								styles.deleteButtonHovered,
						]}
					>
						<Ionicons name="close" size={14} color={colors.textPrimary} />
					</Pressable>
				</Animated.View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	// Six tiles of `TILE`, plus the grid's padding and a scrollbar. The
	// popover's card pads too, so it is wider than 360: a card of 360 would
	// measure five tiles.
	popoverBody: {
		width: 6 * TILE + 5 * GRID_GAP + GRID_PADDING * 2 + SCROLLBAR,
	},
	hovered: {
		backgroundColor: colors.surfacePressed,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
	},
	chipsScroll: {
		flexGrow: 0,
		flexShrink: 0,
	},
	chips: {
		gap: 18,
		paddingHorizontal: 16,
		paddingTop: 14,
		paddingBottom: 6,
	},
	// A tab: its label, underlined while chosen.
	// The hover tint reaches past the label, taken back by the margin.
	chip: {
		paddingHorizontal: 8,
		marginHorizontal: -6,
		paddingVertical: 7,
		borderRadius: radii.small,
	},
	chipHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	// As far past the label as on any other tab.
	chipUnder: {
		marginHorizontal: 4,
	},
	chipLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	gridScroll: {
		height: GRID_HEIGHT,
		flexShrink: 1,
	},
	gridContent: {
		padding: GRID_PADDING,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: GRID_GAP,
	},
	tile: {
		height: TILE,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radii.medium,
		borderCurve: "continuous",
	},
	tilePressed: {
		transform: [{ scale: 0.88 }],
	},
	newTile: {
		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: colors.borderStrong,
	},
	deleteBadge: {
		position: "absolute",
		top: -4,
		right: -4,
	},
	deleteButton: {
		width: 22,
		height: 22,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surfacePressed,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	deleteButtonHovered: {
		backgroundColor: colors.danger,
		borderColor: colors.danger,
	},
	hint: {
		...typography.label,
		width: "100%",
		paddingHorizontal: 4,
		paddingTop: 8,
		lineHeight: 18,
		color: colors.textSecondary,
	},
	sticker: {
		width: 44,
		height: 44,
	},
});
