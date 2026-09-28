import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { DetectionFeature } from "@/detection/imageDetection";
import type { ImageDetectionState } from "@/detection/useImageDetection";
import { colors, radii } from "@/theme";
import { Button } from "@/ui/Button";
import { GlassView } from "@/ui/GlassView";

// Narrower than this, a card's text goes above its buttons rather than beside
// them, where the buttons would leave it a few letters' width.
const STACK_BELOW_WIDTH = 480;

const featureName = (feature: DetectionFeature) =>
	feature === "faces" ? "faces" : "text";

/** The compact workflow for finding, choosing, and applying redactions. */
export function DetectionOptions({
	state,
	available,
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
	available: Record<DetectionFeature, boolean>;
	visibleIndices: readonly number[];
	selectedCount: number;
	bottomInset: number;
	onStart: (feature: DetectionFeature) => void;
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
							<ChooseFeature
								available={available}
								onStart={onStart}
								onClose={onClose}
							/>
						)}
						{state.status === "working" && (
							<Status
								busy
								title={`Finding ${featureName(state.feature)}…`}
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
								onClose={onClose}
							/>
						)}
						{state.status === "empty" && (
							<Status
								title={`No ${featureName(state.feature)} found`}
								message="You can try again or choose the other detector."
								action="Try Again"
								onAction={() => onStart(state.feature)}
								onClose={onClose}
							/>
						)}
						{state.status === "unavailable" && (
							<Status
								title="Not available here"
								message={`${capitalize(featureName(state.feature))} finding isn't supported on this device.`}
								onClose={onClose}
							/>
						)}
						{state.status === "downloading" && (
							<Status
								title="Getting detector ready"
								message="Google Play services is still downloading this model. Try again in a moment."
								action="Try Again"
								onAction={() => onStart(state.feature)}
								onClose={onClose}
							/>
						)}
						{state.status === "failed" && (
							<Status
								title="Couldn't scan this photo"
								message={state.message}
								action="Try Again"
								onAction={() => onStart(state.feature)}
								onClose={onClose}
							/>
						)}
					</GlassView>
				</Animated.View>
			</View>
		</View>
	);
}

function ChooseFeature({
	available,
	onStart,
	onClose,
}: {
	available: Record<DetectionFeature, boolean>;
	onStart: (feature: DetectionFeature) => void;
	onClose: () => void;
}) {
	const unavailable = (["faces", "text"] as const)
		.filter((feature) => !available[feature])
		.map(featureName);
	return (
		<>
			<View style={styles.copy}>
				<Text style={styles.title}>Find to redact</Text>
				<Text style={styles.message}>
					Choose what to look for in this photo.
				</Text>
				{unavailable.length > 0 && (
					<Text style={styles.note}>
						{capitalize(joinNames(unavailable))}{" "}
						{unavailable.length > 1 ? "aren't" : "isn't"} available on this
						device.
					</Text>
				)}
			</View>
			<View style={styles.actions}>
				<Button
					label="Faces"
					icon="person-outline"
					size="small"
					disabled={!available.faces}
					onPress={() => onStart("faces")}
				/>
				<Button
					label="Text"
					icon="text-outline"
					size="small"
					disabled={!available.text}
					onPress={() => onStart("text")}
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
	onClose,
}: {
	count: number;
	selected: number;
	onSelectAll: () => void;
	onClear: () => void;
	onApply: () => void;
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
							label={`Add ${selected}`}
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

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinNames(names: string[]): string {
	return names.length === 2 ? `${names[0]} and ${names[1]}` : (names[0] ?? "");
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
