import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import {
	Image,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { usePreference } from "@/lib/usePreference";
import {
	STICKER_CATEGORY_LABELS,
	STICKERS,
	type Sticker,
	type StickerCategory,
	stickerCategories,
} from "@/stickers/stickers";
import { colors, radii, webTransition } from "@/theme";
import { BottomSheet } from "@/ui/BottomSheet";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";
import { TOOL_KEYS } from "../shortcuts";

const TILE = 56;
const GRID_GAP = 4;
const GRID_PADDING = 12;
// Tall enough for five rows of stickers, so switching categories doesn't
// resize the sheet. On a short screen it gives way first.
const GRID_HEIGHT = 5 * (TILE + GRID_GAP) + GRID_PADDING;

const parseCategory = (saved: unknown): StickerCategory =>
	stickerCategories.find((category) => category === saved) ?? "faces";

/**
 * What can be added to the canvas besides text and drawings: a photo, at the
 * top, then stickers by category, remembering the last one shown. Picking
 * either is up to `onAddPhoto` and `onAddSticker`; a tap outside the sheet,
 * or swiping it down, closes it. Stays mounted while closed, so the sheet
 * can animate out.
 */
export function AddSheet({
	open,
	onClose,
	onAddPhoto,
	onAddSticker,
}: {
	open: boolean;
	onClose: () => void;
	onAddPhoto: () => void;
	onAddSticker: (sticker: Sticker) => void;
}) {
	return (
		<View style={styles.area}>
			{open && (
				<Animated.View
					entering={FadeIn.duration(200)}
					exiting={FadeOut.duration(150)}
					style={StyleSheet.absoluteFill}
				>
					{/* Behind the sheet, not around it: on web, a click on the
					    sheet would bubble up to it and close the sheet. */}
					<Pressable
						style={[StyleSheet.absoluteFill, styles.scrim]}
						onPress={onClose}
						accessibilityLabel="Close"
					/>
				</Animated.View>
			)}
			<View style={styles.column}>
				{open && (
					<BottomSheet title="Add" closeLabel="Close" onClose={onClose}>
						<AddContent onAddPhoto={onAddPhoto} onAddSticker={onAddSticker} />
					</BottomSheet>
				)}
			</View>
		</View>
	);
}

function AddContent({
	onAddPhoto,
	onAddSticker,
}: {
	onAddPhoto: () => void;
	onAddSticker: (sticker: Sticker) => void;
}) {
	const [category, setCategory] = usePreference(
		"stickerCategory",
		parseCategory,
	);
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
			<PhotoRow onPress={onAddPhoto} />
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.chipsScroll}
				contentContainerStyle={styles.chips}
			>
				{stickerCategories.map((each) => (
					<CategoryChip
						key={each}
						label={STICKER_CATEGORY_LABELS[each]}
						selected={each === category}
						onPress={() => setCategory(each)}
					/>
				))}
			</ScrollView>
			<ScrollView
				key={category}
				style={styles.gridScroll}
				contentContainerStyle={styles.gridContent}
			>
				<View
					style={styles.grid}
					onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
				>
					{gridWidth > 0 &&
						STICKERS[category].map((sticker) => (
							<StickerTile
								key={sticker.label}
								sticker={sticker}
								width={tileWidth}
								onPress={() => onAddSticker(sticker)}
							/>
						))}
				</View>
			</ScrollView>
		</>
	);
}

function PhotoRow({ onPress }: { onPress: () => void }) {
	const { anchor, tooltip } = useTooltip("Add a photo", TOOL_KEYS.photo);
	return (
		<>
			<Pressable
				{...anchor}
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel="Photo"
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.photoRow,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.pressed,
					];
				}}
			>
				<View style={styles.photoIcon}>
					<MaterialCommunityIcons
						name="image-plus"
						size={22}
						color={colors.textPrimary}
					/>
				</View>
				<View>
					<Text style={styles.photoLabel}>Photo</Text>
					<Text style={styles.photoHint}>
						{Platform.OS === "web" ? "From your files" : "From your library"}
					</Text>
				</View>
			</Pressable>
			{tooltip}
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
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.chip,
					webTransition,
					hovered && styles.hovered,
					pressed && styles.pressed,
					selected && styles.chipSelected,
				];
			}}
		>
			{(state) => (
				<Text
					style={[
						styles.chipLabel,
						(selected || interaction(state).hovered) && styles.chipLabelLit,
					]}
				>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

function StickerTile({
	sticker,
	width,
	onPress,
}: {
	sticker: Sticker;
	width: number;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={sticker.label}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.tile,
					{ width },
					webTransition,
					hovered && styles.hovered,
					pressed && styles.tilePressed,
				];
			}}
		>
			<Image source={sticker.thumbnail} style={styles.sticker} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Over the whole screen, dock and all.
	area: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "flex-end",
		alignItems: "center",
		pointerEvents: "box-none",
	},
	scrim: {
		backgroundColor: colors.sheetScrim,
	},
	// A phone's width, and no wider on a large screen.
	column: {
		width: "100%",
		maxWidth: 560,
		maxHeight: "75%",
		pointerEvents: "box-none",
	},
	photoRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginHorizontal: 12,
		marginTop: 12,
		padding: 10,
		borderRadius: radii.large,
		borderCurve: "continuous",
		backgroundColor: colors.glassControl,
	},
	photoIcon: {
		width: 40,
		height: 40,
		borderRadius: radii.medium,
		borderCurve: "continuous",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.glassControlHover,
	},
	photoLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	photoHint: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	hovered: {
		backgroundColor: colors.glassControlHover,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
	},
	chipsScroll: {
		flexGrow: 0,
		flexShrink: 0,
	},
	chips: {
		gap: 8,
		paddingHorizontal: 12,
		paddingTop: 14,
		paddingBottom: 6,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 7,
		borderRadius: 999,
		backgroundColor: colors.glassControl,
	},
	chipSelected: {
		backgroundColor: colors.chosenSoft,
	},
	chipLabel: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	chipLabelLit: {
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
	sticker: {
		width: 44,
		height: 44,
	},
});
