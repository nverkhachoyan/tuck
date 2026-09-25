import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
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
	SlideInDown,
	SlideOutDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import type { Layer } from "@/model/document";
import { colors, radii } from "@/theme";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { GlassView } from "@/ui/GlassView";
import { IconButton } from "@/ui/IconButton";
import { LayerRow, type LayerRowActions, ROW_HEIGHT } from "./LayerRow";

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

type LayerListProps = LayerRowActions & {
	layers: Layer[];
	background: string | null;
	selectedLayerId: string | null;
	onSetBackground: (background: string | null) => void;
};

/**
 * The layers list in a card floating over its parent, so opening it never
 * resizes the canvas, which stays usable around it. A "sidebar" sits at the
 * top right, down to `bottomInset` from the bottom; a "sheet" along the
 * bottom, up to half the parent's height.
 *
 * Stays mounted while closed, so the card can animate out. The area around
 * the card is a plain View because `box-none` needs a class on web, and an
 * animated view's style goes inline there.
 */
export function LayersPanel({
	layout,
	bottomInset,
	open,
	onClose,
	...list
}: LayerListProps & {
	layout: "sidebar" | "sheet";
	bottomInset: number;
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
		<View
			style={[styles.sidebarArea, { bottom: bottomInset + SIDEBAR_MARGIN }]}
		>
			{open && (
				<Animated.View
					entering={SIDEBAR_IN}
					exiting={SIDEBAR_OUT}
					style={styles.sidebar}
				>
					<GlassView style={styles.sidebarCard} contentStyle={styles.shrink}>
						<PanelHeader onClose={onClose} />
						<LayerList {...list} compact />
					</GlassView>
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
				style={[styles.sheet, dragged]}
			>
				<GlassView
					style={styles.sheetCard}
					contentStyle={[styles.shrink, { paddingBottom: bottom }]}
				>
					<PanelHeader onClose={onClose} swipe={swipe} />
					{children}
				</GlassView>
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

const handleCursor =
	Platform.OS === "web" ? ({ cursor: "grab" } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
	sidebarArea: {
		position: "absolute",
		top: SIDEBAR_MARGIN,
		right: SIDEBAR_MARGIN,
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
	// Sized to the list until it fills the area, then scrolls: every view
	// down to the list gives way.
	sidebar: {
		maxHeight: "100%",
	},
	sidebarCard: {
		flexShrink: 1,
		borderRadius: radii.extraLarge,
	},
	shrink: {
		flexShrink: 1,
	},
	sheetSlot: {
		maxHeight: "100%",
	},
	sheet: {
		flexShrink: 1,
	},
	sheetCard: {
		flexShrink: 1,
		borderTopLeftRadius: radii.panel,
		borderTopRightRadius: radii.panel,
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
	column: {
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
	},
	header: {
		height: 52,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingLeft: 20,
		paddingRight: 22,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.glassBorder,
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
	label: {
		flex: 1,
		fontSize: 15,
		color: colors.textPrimary,
	},
	empty: {
		height: ROW_HEIGHT,
		lineHeight: ROW_HEIGHT,
		paddingHorizontal: 20,
		fontSize: 14,
		color: colors.textSecondary,
	},
});
