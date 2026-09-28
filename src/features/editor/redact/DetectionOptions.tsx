import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { ImageDetectionState } from "@/detection/useImageDetection";
import { colors, radii } from "@/theme";
import { Button } from "@/ui/Button";
import { GlassView } from "@/ui/GlassView";

// Narrower than this, a card's text goes above its buttons rather than beside
// them, where the buttons would leave it a few letters' width.
const STACK_BELOW_WIDTH = 480;

/** The compact workflow for finding, choosing, and applying redactions. */
export function DetectionOptions({
	state,
	visibleIndices,
	selectedCount,
	bottomInset,
	onStart,
	onSelectAll,
	onClear,
	onApply,
	onClose,
}: {
	state: ImageDetectionState;
	visibleIndices: readonly number[];
	selectedCount: number;
	bottomInset: number;
	onStart: () => void;
	onSelectAll: () => void;
	onClear: () => void;
	onApply: () => void;
	onClose: () => void;
}) {
	// The card's own width, not the window's: the layers sidebar can narrow
	// the canvas on web.
	const [stacked, setStacked] = useState(false);
	return (
		<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
			<View
				pointerEvents="box-none"
				style={[styles.area, { bottom: bottomInset + 10 }]}
			>
				<Animated.View
					entering={FadeIn.duration(120)}
					exiting={FadeOut.duration(100)}
					style={styles.cardWrapper}
					onLayout={(event) =>
						setStacked(event.nativeEvent.layout.width < STACK_BELOW_WIDTH)
					}
				>
					<GlassView
						style={styles.card}
						contentStyle={[styles.content, stacked && styles.stacked]}
					>
						{state.status === "idle" && (
							<Start onStart={onStart} onClose={onClose} />
						)}
						{state.status === "working" && (
							<Status
								busy
								title="Finding faces and text…"
								message="This can take a moment the first time."
								onClose={onClose}
							/>
						)}
						{state.status === "found" && (
							<Found
								count={visibleIndices.length}
								selected={selectedCount}
								onSelectAll={onSelectAll}
								onClear={onClear}
								onApply={onApply}
								issue={state.issues[0]?.message}
								onClose={onClose}
							/>
						)}
						{state.status === "empty" && (
							<Status
								title="Nothing found"
								message={
									state.issues[0]?.message ?? "Try another photo or scan again."
								}
								action="Try Again"
								onAction={onStart}
								onClose={onClose}
							/>
						)}
					</GlassView>
				</Animated.View>
			</View>
		</View>
	);
}

function Start({
	onStart,
	onClose,
}: {
	onStart: () => void;
	onClose: () => void;
}) {
	return (
		<>
			<View style={styles.copy}>
				<Text style={styles.title}>Find to redact</Text>
				<Text style={styles.message}>Scan this photo for faces and text.</Text>
			</View>
			<View style={styles.actions}>
				<Button
					label="Find"
					icon="images-outline"
					variant="primary"
					size="small"
					onPress={onStart}
				/>
				<Button label="Close" size="small" onPress={onClose} />
			</View>
		</>
	);
}

function Found({
	count,
	selected,
	onSelectAll,
	onClear,
	onApply,
	issue,
	onClose,
}: {
	count: number;
	selected: number;
	onSelectAll: () => void;
	onClear: () => void;
	onApply: () => void;
	issue?: string;
	onClose: () => void;
}) {
	return (
		<>
			<View style={styles.copy}>
				<Text style={styles.title}>
					{count === 0
						? "Nothing in the visible crop"
						: `${selected} of ${count} selected`}
				</Text>
				{issue && <Text style={styles.note}>{issue}</Text>}
				<Text style={styles.message}>
					{count === 0
						? "The detector found regions, but none are inside the canvas."
						: "Tap an outlined region to include or leave it out."}
				</Text>
			</View>
			<View style={styles.actions}>
				{count > 0 && (
					<>
						<Button label="All" size="small" onPress={onSelectAll} />
						<Button label="None" size="small" onPress={onClear} />
						<Button
							label={`Redact ${selected}`}
							variant="primary"
							size="small"
							disabled={selected === 0}
							onPress={onApply}
						/>
					</>
				)}
				<Button label="Cancel" size="small" onPress={onClose} />
			</View>
		</>
	);
}

function Status({
	busy = false,
	title,
	message,
	action,
	onAction,
	onClose,
}: {
	busy?: boolean;
	title: string;
	message: string;
	action?: string;
	onAction?: () => void;
	onClose: () => void;
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
			<View style={styles.actions}>
				{action && onAction && (
					<Button label={action} size="small" onPress={onAction} />
				)}
				<Button
					label={busy ? "Cancel" : "Close"}
					size="small"
					onPress={onClose}
				/>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	area: {
		position: "absolute",
		left: 10,
		right: 10,
		alignItems: "center",
	},
	cardWrapper: {
		width: "100%",
		maxWidth: 540,
	},
	card: {
		width: "100%",
		maxWidth: 540,
		borderRadius: radii.extraLarge,
	},
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
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
	},
	message: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	note: {
		fontSize: 12,
		color: colors.textTertiary,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: 8,
	},
});
