import { useLayoutEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, {
	Easing,
	FadeInRight,
	FadeOutRight,
	useSharedValue,
} from "react-native-reanimated";
import type { Layer } from "@/model/document";
import { colors, radii, typography } from "@/theme";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { BottomSheet, PanelHeader } from "@/ui/BottomSheet";
import { GlassView } from "@/ui/GlassView";
import { LayerRow, type LayerRowActions, ROW_HEIGHT } from "./LayerRow";

const SIDEBAR_WIDTH = 340;
const SIDEBAR_MARGIN = 12;
// `webTransition`'s curve, for arriving, and its mirror for leaving.
const DECELERATE = Easing.bezier(0.2, 0, 0, 1);
const ACCELERATE = Easing.bezier(0.3, 0, 1, 1);
const SIDEBAR_IN = FadeInRight.duration(200).easing(DECELERATE);
const SIDEBAR_OUT = FadeOutRight.duration(150).easing(ACCELERATE);

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
					<BottomSheet
						title="Layers"
						closeLabel="Close layers"
						onClose={onClose}
					>
						<LayerList {...list} compact={false} />
					</BottomSheet>
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
						<PanelHeader
							title="Layers"
							closeLabel="Close layers"
							onClose={onClose}
						/>
						<LayerList {...list} compact />
					</GlassView>
				</Animated.View>
			)}
		</View>
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
					Text, drawings, photos, and stickers you add appear here.
				</Text>
			)}
			<View style={styles.row}>
				<Text style={styles.label}>Background</Text>
				<BackgroundPicker value={background} onPick={onSetBackground} />
			</View>
		</ScrollView>
	);
}

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
		borderRadius: radii.large,
	},
	shrink: {
		flexShrink: 1,
	},
	column: {
		width: "100%",
		maxWidth: 560,
		alignSelf: "center",
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
		borderRadius: radii.medium,
		borderWidth: 1,
		borderColor: "transparent",
	},
	label: {
		...typography.body,
		flex: 1,
		color: colors.textPrimary,
	},
	empty: {
		...typography.label,
		height: ROW_HEIGHT,
		lineHeight: ROW_HEIGHT,
		paddingHorizontal: 20,
		color: colors.textSecondary,
	},
});
