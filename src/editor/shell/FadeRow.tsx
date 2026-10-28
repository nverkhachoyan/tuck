import {
	Children,
	createContext,
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
	ScrollView,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { fadeTo } from "@/ui/gradient";
import { colors } from "@/ui/theme";
import {
	fadeCut,
	fadeCutLeft,
	type ItemBox,
	leafEdges,
	rowEdges,
} from "./rowFade";

// How wide the fade is. On either side it ends on the first option that
// doesn't fit whole, so the edge falls between options instead of across a label.
const FADE_WIDTH = 32;
// Long enough that a drag's scroll events, throttled below, don't each move
// the fade: it settles once they stop.
const FADE_SETTLE_MS = 120;

// Item positions, in a group's coordinates or a parent item's, so the fade
// can add them up to a position in the scrolling row.
type RowMetricsApi = {
	reportGroup: (id: string, x: number) => void;
	reportItem: (id: string, parent: string, x: number, width: number) => void;
	forgetGroup: (id: string) => void;
	forgetItem: (id: string) => void;
};

const RowMetrics = createContext<RowMetricsApi | null>(null);
// The group, or the measured option, this control is laid out in.
const RowParent = createContext<string | null>(null);

function near(a: number, b: number) {
	return Math.abs(a - b) < 0.5;
}

/**
 * One measured option. Its `onLayout` x is relative to its parent, and nested
 * options (a segment inside a segmented control) report through `RowParent`,
 * so a box that only wraps other options isn't where the fade stops.
 */
export function MeasuredItem({ children }: { children: ReactNode }) {
	const metrics = useContext(RowMetrics);
	const parent = useContext(RowParent);
	const id = useId();
	useEffect(() => () => metrics?.forgetItem(id), [metrics, id]);
	return (
		<RowParent.Provider value={id}>
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
		</RowParent.Provider>
	);
}

/**
 * A row of options laid out straight in a `FadeRow`, each one measured.
 * Elsewhere it's a plain view.
 */
export function FadeGroup({
	style,
	children,
}: {
	style: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	const metrics = useContext(RowMetrics);
	const measured = useContext(RowParent) != null;
	const groupId = useId();
	const items = Children.toArray(children);
	useEffect(() => () => metrics?.forgetGroup(groupId), [metrics, groupId]);
	if (items.length === 0) return null;
	return (
		<RowParent.Provider value={measured ? groupId : null}>
			<View
				style={style}
				onLayout={(event) => {
					if (measured) {
						metrics?.reportGroup(groupId, event.nativeEvent.layout.x);
					}
				}}
			>
				{items.map((item) => (
					<MeasuredItem key={isValidElement(item) ? item.key : "item"}>
						{item}
					</MeasuredItem>
				))}
			</View>
		</RowParent.Provider>
	);
}

/** Controls in a `FadeRow` that aren't its options, such as a popover's. */
export function Unmeasured({ children }: { children: ReactNode }) {
	return <RowParent.Provider value={null}>{children}</RowParent.Provider>;
}

/**
 * A row that scrolls sideways when it doesn't fit, and fades out where more
 * of it is hidden.
 * - Its options are each a `MeasuredItem`, laid out straight in the row or in
 *   a `FadeGroup`. The fade ends between them, rather than across a label.
 * - The fade settles once scrolling stops.
 * - With no options measured, the right edge fades while more is past it.
 */
export function FadeRow({
	style,
	contentStyle,
	children,
}: {
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	// Options laid out straight in the row measure from its start.
	const rowId = useId();
	const [width, setWidth] = useState(0);
	const [contentWidth, setContentWidth] = useState(0);
	const [offset, setOffset] = useState(0);
	const [groups, setGroups] = useState<Record<string, number>>(() => ({
		[rowId]: 0,
	}));
	const [items, setItems] = useState<Record<string, ItemBox>>({});
	const offsetRef = useRef(0);
	const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (settle.current) clearTimeout(settle.current);
		},
		[],
	);
	const metrics = useMemo<RowMetricsApi>(
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
		<RowMetrics.Provider value={metrics}>
			<RowParent.Provider value={rowId}>
				<View style={[styles.row, style]}>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={contentStyle}
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
									<View
										style={[styles.coverLeft, { width: cutLeft - offset }]}
									/>
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
					{cut == null &&
						cutLeft == null &&
						overflows &&
						leaves.length === 0 && (
							<View pointerEvents="none" style={styles.fadeEnd} />
						)}
				</View>
			</RowParent.Provider>
		</RowMetrics.Provider>
	);
}

const styles = StyleSheet.create({
	row: {
		minWidth: 0,
		overflow: "hidden",
	},
	item: {
		flexShrink: 0,
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
});
