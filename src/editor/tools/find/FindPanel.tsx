import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ReactNode, useState } from "react";
import {
	type AccessibilityActionEvent,
	ActivityIndicator,
	type KeyDownEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Announcement } from "@/ui/Announcement";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { interaction } from "@/ui/interaction";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { BarGroup, BarSections } from "../../shell/ContextBar";
import {
	EffectGlyph,
	RedactLookOptions,
	redactLookItems,
} from "../../shell/redactStyle";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import { ToolOptions, Tray } from "../../shell/ToolOptions";
import { useRedactLook } from "../../shell/useRedactLook";
import type { FindController, FindReview } from "./useFindTool";
import type { DetectionScope, ImageDetectionState } from "./useImageDetection";

// Narrower than this, the tray's text goes above its buttons rather than beside
// them, where the buttons would leave it a few letters' width.
const STACK_BELOW_WIDTH = 480;

/**
 * What Find looks for, in place of the toolbar: faces, text, or both, each
 * scanning the photo as it's picked, and the style what's found is redacted
 * in, which opens over the canvas.
 */
export function FindPanel({
	controller: { state, find },
}: {
	controller: FindController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();
	const { look } = useRedactLook();
	const scanned = state.status === "idle" ? null : state.scope;
	return (
		<ToolRow>
			{SCOPES.map(({ scope, label, icon }) => (
				<ToolButton
					key={scope}
					label={label}
					icon={icon}
					selected={scanned === scope}
					busy={state.status === "working" && scanned === scope}
					onPress={() => find(scope)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<EffectGlyph settings={look} effect={look.effect} />}
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

const SCOPES = [
	{ scope: "faces", label: "Faces", icon: "face-recognition" },
	{ scope: "text", label: "Text", icon: "text-recognition" },
	{ scope: "both", label: "Both", icon: "image-search-outline" },
] as const;

/**
 * Find's options in the wide editor's header: the effect what Done redacts
 * is drawn with, and its color when that's solid. Faces, text, and the
 * results sit in the inspector, above the layers they'll join.
 */
export function FindBar() {
	const { look, changeLook } = useRedactLook();
	const colorTarget = useColorTarget((color) => changeLook({ color }));
	return (
		<BarSections>
			<BarGroup>
				{redactLookItems({
					settings: look,
					onChange: changeLook,
					...colorTarget,
				})}
			</BarGroup>
		</BarSections>
	);
}

/**
 * How the scan is going, then what it found, to choose from and redact, in
 * a tray. It has no backdrop: taps on the canvas toggle the regions found.
 */
export function FindTray({ controller }: { controller: FindController }) {
	const { bottomInset, cancel } = useEditorContext();
	// The tray's own width, not the window's: the layers sidebar can narrow
	// the canvas on web.
	const [stacked, setStacked] = useState(false);
	return (
		<Tray bottomInset={bottomInset}>
			<FindBody
				controller={controller}
				stacked={stacked}
				onMeasure={(width) => setStacked(width < STACK_BELOW_WIDTH)}
				onCancel={cancel}
			/>
		</Tray>
	);
}

/** The look Find redacts with, in a tray above the dock (see `ToolOptions`). */
export function FindOptions() {
	const { bottomInset, closeTray } = useEditorContext();
	const { look, changeLook } = useRedactLook();
	const colorTarget = useColorTarget((color) => changeLook({ color }));
	return (
		<ToolOptions
			closeLabel="Close redaction style"
			bottomInset={bottomInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			<RedactLookOptions
				settings={look}
				onChange={changeLook}
				{...colorTarget}
			/>
		</ToolOptions>
	);
}

/**
 * Find on a wide screen: what to look for, and what was found, above the
 * layers. The bar holds the style, so this section has no Style button.
 */
export function FindInspector({
	controller,
	children,
}: {
	controller: FindController;
	children: ReactNode;
}) {
	const { cancel } = useEditorContext();
	const { state, find } = controller;
	const scanned = state.status === "idle" ? null : state.scope;
	return (
		<View style={styles.inspectorStack}>
			<View style={styles.findSection}>
				<View style={styles.scopes}>
					{SCOPES.map(({ scope, label, icon }) => (
						<ToolButton
							key={scope}
							label={label}
							icon={icon}
							selected={scanned === scope}
							busy={state.status === "working" && scanned === scope}
							onPress={() => find(scope)}
						/>
					))}
				</View>
				<FindBody controller={controller} stacked onCancel={cancel} />
			</View>
			{children}
		</View>
	);
}

function FindBody({
	controller,
	stacked,
	onMeasure,
	onCancel,
}: {
	controller: FindController;
	stacked: boolean;
	onMeasure?: (width: number) => void;
	onCancel: () => void;
}) {
	const { state, visibleIndices, selectedCount, review } = controller;
	const { retry, reset, selectAll, clear } = controller;
	return (
		<>
			<Announcement
				message={
					review.current
						? reviewValue(review)
						: announcement(state, visibleIndices.length, selectedCount)
				}
			/>
			<View
				style={[styles.content, stacked && styles.stacked]}
				onLayout={
					onMeasure
						? (event) => onMeasure(event.nativeEvent.layout.width)
						: undefined
				}
			>
				{state.status === "idle" && (
					<Status
						title="Find faces or text"
						message="Pick what to look for, then tap what's found to choose what to redact."
					/>
				)}
				{state.status === "working" && (
					<Status
						busy
						title={`Finding ${scopeName(state.scope)}…`}
						message="This can take a moment the first time."
						action="Stop"
						onAction={reset}
					/>
				)}
				{state.status === "found" && (
					<Found
						count={visibleIndices.length}
						selected={selectedCount}
						review={review}
						onSelectAll={selectAll}
						onClear={clear}
						issue={state.issues[0]?.message}
					/>
				)}
				{/* A scan that failed can be tried again; one that found nothing
				    leaves drawing a box by hand, in Redact. */}
				{state.status === "empty" &&
					(state.issues[0] ? (
						<Status
							title={`No ${scopeName(state.scope)} found`}
							message={state.issues[0].message}
							action="Try again"
							onAction={retry}
						/>
					) : (
						<Status
							title={`No ${scopeName(state.scope)} found`}
							message="Draw a box over it with Redact instead."
							action="Close"
							onAction={onCancel}
						/>
					))}
			</View>
		</>
	);
}

// What a screen reader hears as the scan goes and the choice changes.
function announcement(
	state: ImageDetectionState,
	count: number,
	selected: number,
): string | null {
	switch (state.status) {
		case "idle":
			return null;
		case "working":
			return `Finding ${scopeName(state.scope)}`;
		case "found":
			return count === 0
				? "Nothing found in the visible crop"
				: foundTitle(count, selected);
		case "empty":
			return `No ${scopeName(state.scope)} found`;
	}
}

// What was found and what's chosen of it, once some are left out.
function foundTitle(count: number, selected: number): string {
	return selected === count
		? `${count} found`
		: `${selected} of ${count} chosen`;
}

function scopeName(scope: DetectionScope): string {
	return scope === "both" ? "faces or text" : scope;
}

function Found({
	count,
	selected,
	review,
	onSelectAll,
	onClear,
	issue,
}: {
	count: number;
	selected: number;
	review: FindReview;
	onSelectAll: () => void;
	onClear: () => void;
	issue?: string;
}) {
	return (
		<>
			<View style={styles.copy}>
				<Text style={styles.title}>
					{count === 0
						? "Nothing in the visible crop"
						: foundTitle(count, selected)}
				</Text>
				{issue && <Text style={styles.note}>{issue}</Text>}
				<Text style={styles.message}>
					{count === 0
						? "The detector found regions, but none are inside the canvas."
						: "Detection can miss some. Check the photo, then ✓ to redact."}
				</Text>
			</View>
			{count > 0 && (
				<View style={styles.actions}>
					<Button label="All" size="small" onPress={onSelectAll} />
					<Button label="None" size="small" onPress={onClear} />
					<ReviewRow review={review} />
				</View>
			)}
		</>
	);
}

// What a screen reader hears for the region under review.
function reviewValue({ current }: FindReview): string {
	if (!current) return "";
	const kind = current.feature === "faces" ? "Face" : "Text";
	const state = current.included ? "included" : "left out";
	return `${kind} ${current.position + 1} of ${current.count}, ${state}`;
}

/**
 * What was found, one region at a time: back, where the review is, on, and
 * whether the region shown is included. Each step zooms the canvas to it.
 * For a screen reader it's one adjustable control (swipe up or down to step,
 * double tap to include or leave out); on web, while it has focus, the arrow
 * keys step and Space toggles, without reaching the editor's shortcuts.
 */
function ReviewRow({ review }: { review: FindReview }) {
	const { current, count, step, toggle, stop } = review;
	const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
		if (nativeEvent.actionName === "increment") step(1);
		else if (nativeEvent.actionName === "decrement") step(-1);
		else if (nativeEvent.actionName === "activate") {
			if (current) toggle();
			else step(1);
		}
	};
	const keys =
		Platform.OS === "web"
			? {
					onKeyDown: (event: KeyDownEvent) => {
						const { key } = event.nativeEvent;
						const delta = REVIEW_KEYS[key];
						// Space on one of the row's buttons presses that button.
						const toggles = key === " " && event.target === event.currentTarget;
						if (!delta && !toggles) return;
						event.preventDefault();
						event.stopPropagation();
						if (delta) step(delta);
						else if (current) toggle();
					},
				}
			: {};
	return (
		<View
			{...keys}
			accessible
			focusable
			accessibilityRole="adjustable"
			accessibilityLabel="Review"
			aria-valuemin={1}
			aria-valuemax={count}
			aria-valuenow={current ? current.position + 1 : undefined}
			aria-valuetext={current ? reviewValue(review) : `${count} to review`}
			accessibilityActions={REVIEW_ACTIONS}
			onAccessibilityAction={onAccessibilityAction}
			style={styles.review}
		>
			<IconButton
				icon="chevron-back"
				label="Previous"
				disabled={current?.position === 0}
				onPress={() => step(-1)}
			/>
			<Text style={styles.reviewPlace}>
				{current ? `${current.position + 1} of ${count}` : "Review"}
			</Text>
			<IconButton
				icon="chevron-forward"
				label="Next"
				disabled={current?.position === count - 1}
				onPress={() => step(1)}
			/>
			{current && (
				<>
					<IncludeSwitch included={current.included} onPress={toggle} />
					<IconButton icon="close" label="Stop reviewing" onPress={stop} />
				</>
			)}
		</View>
	);
}

const REVIEW_KEYS: Record<string, 1 | -1 | undefined> = {
	ArrowRight: 1,
	ArrowDown: 1,
	ArrowLeft: -1,
	ArrowUp: -1,
};

const REVIEW_ACTIONS = [
	{ name: "increment" },
	{ name: "decrement" },
	{ name: "activate" },
];

// Whether the region under review is included: a box that's checked or not.
function IncludeSwitch({
	included,
	onPress,
}: {
	included: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={6}
			onPress={onPress}
			accessibilityRole="switch"
			accessibilityLabel="Include"
			accessibilityState={{ checked: included }}
			aria-checked={included}
		>
			{(state) => {
				const { hovered, pressed } = interaction(state);
				return (
					<View
						style={[
							styles.include,
							webTransition,
							hovered && styles.includeHovered,
							pressed && styles.includePressed,
						]}
					>
						<MaterialCommunityIcons
							name={included ? "checkbox-marked" : "checkbox-blank-outline"}
							size={20}
							color={included ? colors.selection : colors.textPrimary}
						/>
						<Text style={styles.includeLabel}>Include</Text>
					</View>
				);
			}}
		</Pressable>
	);
}

function Status({
	busy = false,
	title,
	message,
	action,
	onAction,
}: {
	busy?: boolean;
	title: string;
	message: string;
	action?: string;
	onAction?: () => void;
}) {
	return (
		<>
			<View style={[styles.copy, busy && styles.working]}>
				{busy && <ActivityIndicator color={colors.textPrimary} />}
				<View style={styles.copy}>
					<Text style={styles.title}>{title}</Text>
					<Text selectable style={styles.message}>
						{message}
					</Text>
				</View>
			</View>
			{action && onAction && (
				<View style={styles.actions}>
					<Button label={action} size="small" onPress={onAction} />
				</View>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	content: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 16,
		paddingHorizontal: 18,
		paddingVertical: 12,
	},
	stacked: {
		flexDirection: "column",
		alignItems: "stretch",
		gap: 12,
		paddingTop: 14,
	},
	copy: {
		flexShrink: 1,
		gap: 3,
	},
	working: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	title: {
		...typography.bodyStrong,
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
	},
	message: {
		...typography.label,
		color: colors.textSecondary,
	},
	note: {
		...typography.caption,
		color: colors.textSecondary,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: 8,
	},
	review: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		paddingHorizontal: space.xs,
		borderRadius: radii.medium,
	},
	reviewPlace: {
		...typography.bodyStrong,
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
		minWidth: 64,
		textAlign: "center",
	},
	include: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xxs,
		paddingVertical: space.xxs,
		paddingHorizontal: 6,
		borderRadius: radii.small,
	},
	includeHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	includePressed: {
		backgroundColor: colors.pressedOverlay,
	},
	includeLabel: {
		...typography.label,
		color: colors.textPrimary,
	},
	inspectorStack: {
		flexShrink: 1,
	},
	findSection: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	scopes: {
		flexDirection: "row",
		justifyContent: "center",
		paddingTop: space.xs,
	},
});
