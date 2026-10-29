import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LegacyScrollView, ScrollView } from "react-native-gesture-handler";
import Animated, {
	Easing,
	FadeInRight,
	FadeOutRight,
	useSharedValue,
} from "react-native-reanimated";
import type { EditorDocument, LayerGroup } from "@/model/document";
import type { Layer } from "@/model/layers/layer";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { BottomSheet, PanelHeader } from "@/ui/BottomSheet";
import { IconButton } from "@/ui/IconButton";
import { Surface } from "@/ui/Surface";
import { colors, radii, typography } from "@/ui/theme";
import type { EditorStoreActions } from "../store/editorSlice";
import { LayerRow, type LayerRowActions, ROW_HEIGHT } from "./LayerRow";
import { layerListEntries } from "./layerListEntries";

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
	groups: LayerGroup[];
	background: string | null;
	selectedLayerId: string | null;
	onSetBackground: (background: string | null) => void;
	onSetGroupHidden: (id: string, hidden: boolean) => void;
	onSetGroupLocked: (id: string, locked: boolean) => void;
	onDeleteGroup: (id: string) => void;
};

/**
 * The layers list in a card floating over its parent, so opening it never
 * resizes the canvas, which stays usable around it. A "sidebar" sits at the
 * top right, down to `bottomInset` from the bottom; a "sheet" along the
 * bottom, up to half the parent's height. In the "inspector" of a wide
 * screen, it's the column's resting content, always shown.
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
	layout: "sidebar" | "sheet" | "inspector";
	bottomInset: number;
	open: boolean;
	onClose: () => void;
}) {
	if (layout === "inspector") {
		return (
			<View style={styles.inspector}>
				<Text style={styles.inspectorTitle} accessibilityRole="header">
					Layers
				</Text>
				<LayerList {...list} compact />
			</View>
		);
	}
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
					<Surface style={styles.sidebarCard} contentStyle={styles.shrink}>
						<PanelHeader
							title="Layers"
							closeLabel="Close layers"
							onClose={onClose}
						/>
						<LayerList {...list} compact />
					</Surface>
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
	onSelect,
	onMove,
	onSetHidden,
	onSetLocked,
	onDelete,
	...props
}: LayerListProps & { compact: boolean }) {
	const rowActions = { onSelect, onMove, onSetHidden, onSetLocked, onDelete };
	return props.groups.length > 0 ? (
		<GroupedLayerList {...props} rowActions={rowActions} />
	) : (
		<FlatLayerList {...props} rowActions={rowActions} />
	);
}

// A list's props, with the rows' actions gathered for each row to take.
type ListBodyProps = Omit<LayerListProps, keyof LayerRowActions> & {
	compact: boolean;
	rowActions: LayerRowActions;
};

function FlatLayerList({
	layers,
	background,
	selectedLayerId,
	onSetBackground,
	compact,
	rowActions,
}: ListBodyProps) {
	const rows = useMemo(() => layers.slice().reverse(), [layers]);
	const order = useSharedValue(rows.map((layer) => layer.id));
	const dragId = useSharedValue<string | null>(null);
	const scrollRef = useRef<LegacyScrollView>(null);

	useLayoutEffect(() => {
		order.value = rows.map((layer) => layer.id);
	}, [order, rows]);

	return (
		<LegacyScrollView
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
						{...rowActions}
					/>
				))}
			</View>
			{rows.length === 0 && (
				<Text style={styles.empty}>
					Text, drawings, photos, and stickers you add appear here.
				</Text>
			)}
			<BackgroundRow value={background} onPick={onSetBackground} />
		</LegacyScrollView>
	);
}

function GroupedLayerList({
	layers,
	groups,
	background,
	selectedLayerId,
	onSetBackground,
	compact,
	rowActions,
	onSetGroupHidden,
	onSetGroupLocked,
	onDeleteGroup,
}: ListBodyProps) {
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const entries = useMemo(
		() => layerListEntries(layers, groups),
		[layers, groups],
	);
	return (
		<ScrollView contentContainerStyle={[styles.column, styles.content]}>
			{entries.map((entry) => {
				if (entry.type === "layer") {
					const { layer } = entry;
					return (
						<StaticLayerRow
							key={layer.id}
							layer={layer}
							selected={layer.id === selectedLayerId}
							compact={compact}
							{...rowActions}
						/>
					);
				}
				const { group, layers: children } = entry;
				const isExpanded = expanded.has(group.id);
				return (
					<View key={group.id}>
						<GroupRow
							group={group}
							layers={children}
							expanded={isExpanded}
							compact={compact}
							onToggle={() =>
								setExpanded((current) => {
									const next = new Set(current);
									if (next.has(group.id)) next.delete(group.id);
									else next.add(group.id);
									return next;
								})
							}
							onSetHidden={onSetGroupHidden}
							onSetLocked={onSetGroupLocked}
							onDelete={onDeleteGroup}
						/>
						{isExpanded &&
							children.map((child) => (
								<View key={child.id} style={styles.groupChild}>
									<StaticLayerRow
										layer={child}
										selected={child.id === selectedLayerId}
										compact={compact}
										{...rowActions}
									/>
								</View>
							))}
					</View>
				);
			})}
			<BackgroundRow value={background} onPick={onSetBackground} />
		</ScrollView>
	);
}

// The canvas's background, under the layers.
function BackgroundRow({
	value,
	onPick,
}: {
	value: string | null;
	onPick: (background: string | null) => void;
}) {
	return (
		<View style={styles.row}>
			<Text style={styles.label}>Background</Text>
			<BackgroundPicker value={value} onPick={onPick} />
		</View>
	);
}

function StaticLayerRow(
	props: Omit<
		Parameters<typeof LayerRow>[0],
		"slot" | "count" | "order" | "dragId" | "scrollRef" | "staticRow"
	>,
) {
	const order = useSharedValue<string[]>([]);
	const dragId = useSharedValue<string | null>(null);
	const scrollRef = useRef<LegacyScrollView>(null);
	return (
		<LayerRow
			{...props}
			slot={0}
			count={1}
			order={order}
			dragId={dragId}
			scrollRef={scrollRef}
			staticRow
		/>
	);
}

function GroupRow({
	group,
	layers,
	expanded,
	compact,
	onToggle,
	onSetHidden,
	onSetLocked,
	onDelete,
}: {
	group: LayerGroup;
	layers: Layer[];
	expanded: boolean;
	compact: boolean;
	onToggle: () => void;
	onSetHidden: (id: string, hidden: boolean) => void;
	onSetLocked: (id: string, locked: boolean) => void;
	onDelete: (id: string) => void;
}) {
	const hidden = layers.every((layer) => layer.hidden);
	const locked = layers.every((layer) => layer.locked);
	return (
		<View style={[styles.groupRow, hidden && styles.dimmed]}>
			<Pressable
				style={styles.groupMain}
				onPress={onToggle}
				accessibilityRole="button"
				accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${group.name}`}
			>
				<Text style={styles.disclosure}>{expanded ? "⌄" : "›"}</Text>
				<Text style={styles.groupLabel} numberOfLines={1}>
					{group.name} · {layers.length}
				</Text>
			</Pressable>
			<View style={[styles.groupActions, compact && styles.compactActions]}>
				<IconButton
					icon={hidden ? "eye-off-outline" : "eye-outline"}
					label={hidden ? `Show ${group.name}` : `Hide ${group.name}`}
					onPress={() => onSetHidden(group.id, !hidden)}
				/>
				<IconButton
					icon={locked ? "lock-closed-outline" : "lock-open-outline"}
					label={locked ? `Unlock ${group.name}` : `Lock ${group.name}`}
					onPress={() => onSetLocked(group.id, !locked)}
				/>
				<IconButton
					icon="trash-outline"
					label={`Delete ${group.name}`}
					onPress={() => onDelete(group.id)}
				/>
			</View>
		</View>
	);
}

type LayerListActions = Pick<
	EditorStoreActions,
	| "selectLayer"
	| "moveLayer"
	| "setLayerHidden"
	| "setLayerLocked"
	| "deleteLayer"
	| "setLayerGroupHidden"
	| "setLayerGroupLocked"
	| "deleteLayerGroup"
	| "setBackground"
>;

/** The layers panel's props, from the document, the selection, and the store. */
export function layerListProps({
	document,
	selectedLayer,
	actions,
	onClose,
	bottomInset,
}: {
	document: EditorDocument;
	selectedLayer: Layer | undefined;
	actions: LayerListActions;
	onClose: () => void;
	bottomInset: number;
}) {
	return {
		layers: document.layers,
		groups: document.groups ?? [],
		background: document.background,
		selectedLayerId: selectedLayer?.id ?? null,
		onSelect: actions.selectLayer,
		onMove: actions.moveLayer,
		onSetHidden: actions.setLayerHidden,
		onSetLocked: actions.setLayerLocked,
		onDelete: actions.deleteLayer,
		onSetGroupHidden: actions.setLayerGroupHidden,
		onSetGroupLocked: actions.setLayerGroupLocked,
		onDeleteGroup: actions.deleteLayerGroup,
		onSetBackground: actions.setBackground,
		onClose,
		bottomInset,
	};
}

const styles = StyleSheet.create({
	sidebarArea: {
		position: "absolute",
		top: SIDEBAR_MARGIN,
		right: SIDEBAR_MARGIN,
		width: SIDEBAR_WIDTH,
		pointerEvents: "box-none",
	},
	inspector: {
		flex: 1,
		paddingTop: 12,
	},
	inspectorTitle: {
		...typography.bodyStrong,
		color: colors.textPrimary,
		paddingHorizontal: 20,
		paddingBottom: 8,
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
	groupRow: {
		height: ROW_HEIGHT,
		flexDirection: "row",
		alignItems: "center",
		marginHorizontal: 8,
		paddingLeft: 12,
		borderRadius: radii.medium,
		backgroundColor: colors.surfaceHover,
	},
	groupMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
	disclosure: { ...typography.title, color: colors.textSecondary },
	groupLabel: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
	groupActions: { flexDirection: "row", gap: 22, paddingLeft: 12 },
	compactActions: { gap: 14 },
	groupChild: { marginLeft: 16 },
	dimmed: { opacity: 0.4 },
});
