import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { Announcement } from "./Announcement";
import { colors, floatingShadow, radii, space, typography } from "./theme";

const RISE = { duration: 160, easing: Easing.out(Easing.cubic) };
// Reveal the optional reassurance note only once work has run long enough
// that someone might wonder if it's stuck (e.g. first-time model load or WASM).
const SLOW_MS = 1800;

/**
 * Says that on-device work is running, floating over the bottom of the canvas
 * in the same slot as `Toast` without blocking touches.
 * - `message`: short active status (e.g. "Removing background…"), also read
 *   out to a screen reader.
 * - `detail`: quieter note shown underneath if the work runs past `SLOW_MS`.
 * - `delayMs`: wait before appearing or announcing, so fast operations don't
 *   flash.
 * - `inset`: keeps it clear of the dock, rail, sidebar, and any open tray.
 */
export function BusyBanner({
	message,
	detail,
	delayMs = 0,
	inset,
}: {
	message: string;
	detail?: string;
	delayMs?: number;
	inset: Pick<ViewStyle, "left" | "right" | "bottom">;
}) {
	return (
		<TimedBusyBanner
			key={message}
			message={message}
			detail={detail}
			delayMs={delayMs}
			inset={inset}
		/>
	);
}

function TimedBusyBanner({
	message,
	detail,
	delayMs,
	inset,
}: {
	message: string;
	detail?: string;
	delayMs: number;
	inset: Pick<ViewStyle, "left" | "right" | "bottom">;
}) {
	const [visible, setVisible] = useState(delayMs <= 0);
	const [showDetail, setShowDetail] = useState(false);

	useEffect(() => {
		if (delayMs <= 0) {
			setVisible(true);
			return;
		}
		setVisible(false);
		const timer = setTimeout(() => setVisible(true), delayMs);
		return () => clearTimeout(timer);
	}, [delayMs]);

	useEffect(() => {
		setShowDetail(false);
		if (!visible || !detail) return;
		const timer = setTimeout(() => setShowDetail(true), SLOW_MS);
		return () => clearTimeout(timer);
	}, [visible, detail]);

	if (!visible) return null;
	return (
		<BusyBannerView
			message={message}
			detail={showDetail ? detail : undefined}
			inset={inset}
		/>
	);
}

function BusyBannerView({
	message,
	detail,
	inset,
}: {
	message: string;
	detail?: string;
	inset: Pick<ViewStyle, "left" | "right" | "bottom">;
}) {
	const reduceMotion = useReducedMotion();
	const progress = useSharedValue(reduceMotion ? 1 : 0);
	useEffect(() => {
		progress.value = withTiming(1, RISE);
	}, [progress]);
	const appear = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: (1 - progress.value) * 6 }],
	}));
	return (
		<View style={[styles.area, inset]}>
			<Announcement message={message} />
			<Animated.View
				accessibilityRole="progressbar"
				accessibilityLabel={detail ? `${message} ${detail}` : message}
				style={[styles.banner, appear]}
			>
				<ActivityIndicator size="small" color={colors.textPrimary} />
				<View style={styles.copy}>
					<Text style={styles.message} numberOfLines={1}>
						{message}
					</Text>
					{detail && <Text style={styles.detail}>{detail}</Text>}
				</View>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	// A plain view carries `pointerEvents: "none"`: on web, Reanimated drops
	// `pointerEvents` from an animated view's inline style.
	area: {
		position: "absolute",
		alignItems: "center",
		paddingHorizontal: space.md,
		pointerEvents: "none",
	},
	banner: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.sm,
		minHeight: 44,
		maxWidth: 420,
		paddingHorizontal: space.md,
		paddingVertical: 10,
		borderRadius: radii.medium,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
		boxShadow: floatingShadow,
	},
	copy: {
		flexShrink: 1,
		gap: 2,
	},
	message: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	detail: {
		...typography.caption,
		color: colors.textSecondary,
	},
});
