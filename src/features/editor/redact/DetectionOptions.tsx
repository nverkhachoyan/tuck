import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type {
	DetectionScope,
	ImageDetectionState,
} from "@/detection/useImageDetection";
import { colors, typography } from "@/theme";
import { Button } from "@/ui/Button";
import { ToolButton, ToolRow } from "../ToolButton";
import { Tray } from "../ToolOptions";
import { EffectGlyph } from "./RedactPanel";
import type { RedactSettings } from "./redactSettings";

// Narrower than this, the tray's text goes above its buttons rather than beside
// them, where the buttons would leave it a few letters' width.
const STACK_BELOW_WIDTH = 480;

/**
 * What Find looks for, in place of the toolbar: faces, text, or both, each
 * scanning the photo as it's picked, and the style what's found is redacted
 * in, which opens over the canvas.
 */
export function FindPanel({
	state,
	settings,
	optionsOpen,
	onFind,
	onToggleOptions,
}: {
	state: ImageDetectionState;
	settings: RedactSettings;
	optionsOpen: boolean;
	onFind: (scope: DetectionScope) => void;
	onToggleOptions: () => void;
}) {
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
					onPress={() => onFind(scope)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<EffectGlyph settings={settings} effect={settings.effect} />}
				open={optionsOpen}
				onPress={onToggleOptions}
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
 * How the scan is going, then what it found, to choose from and redact, in
 * a tray. It has no backdrop: taps on the canvas toggle the regions found.
 */
export function DetectionOptions({
	state,
	visibleIndices,
	selectedCount,
	bottomInset,
	onRetry,
	onStop,
	onSelectAll,
	onClear,
	onApply,
}: {
	state: ImageDetectionState;
	visibleIndices: readonly number[];
	selectedCount: number;
	bottomInset: number;
	onRetry: () => void;
	onStop: () => void;
	onSelectAll: () => void;
	onClear: () => void;
	onApply: () => void;
}) {
	// The tray's own width, not the window's: the layers sidebar can narrow
	// the canvas on web.
	const [stacked, setStacked] = useState(false);
	return (
		<Tray bottomInset={bottomInset}>
			<View
				style={[styles.content, stacked && styles.stacked]}
				onLayout={(event) =>
					setStacked(event.nativeEvent.layout.width < STACK_BELOW_WIDTH)
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
						onAction={onStop}
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
					/>
				)}
				{state.status === "empty" && (
					<Status
						title={`No ${scopeName(state.scope)} found`}
						message={
							state.issues[0]?.message ?? "Try another photo or scan again."
						}
						action="Try Again"
						onAction={onRetry}
					/>
				)}
			</View>
		</Tray>
	);
}

function scopeName(scope: DetectionScope): string {
	return scope === "both" ? "faces or text" : scope;
}

function Found({
	count,
	selected,
	onSelectAll,
	onClear,
	onApply,
	issue,
}: {
	count: number;
	selected: number;
	onSelectAll: () => void;
	onClear: () => void;
	onApply: () => void;
	issue?: string;
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
			{count > 0 && (
				<View style={styles.actions}>
					<Button label="All" size="small" onPress={onSelectAll} />
					<Button label="None" size="small" onPress={onClear} />
					<Button
						label={`Redact selected (${selected})`}
						variant="primary"
						size="small"
						disabled={selected === 0}
						onPress={onApply}
					/>
				</View>
			)}
		</>
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
		color: colors.textTertiary,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		gap: 8,
	},
});
