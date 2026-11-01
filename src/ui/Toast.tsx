import { useEffect } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { Announcement } from "./Announcement";
import { IconButton } from "./IconButton";
import { TextButton } from "./TextButton";
import { colors, floatingShadow, radii, space, typography } from "./theme";

const RISE = { duration: 160, easing: Easing.out(Easing.cubic) };

/**
 * A short note that something happened, floating over the bottom of the
 * canvas, with an action to take it back, after `secondAction` when there's
 * one, and a dismiss ✕ on the right when `onDismiss` is given. `inset`
 * keeps it clear of the dock
 * and any panel beside the canvas. It rises in as it mounts, and a screen
 * reader hears it too. Whoever shows it decides when it goes.
 */
export function Toast({
	message,
	action,
	onAction,
	secondAction,
	onDismiss,
	inset,
}: {
	message: string;
	action: string;
	onAction: () => void;
	secondAction?: { label: string; onPress: () => void };
	onDismiss?: () => void;
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
			<Animated.View style={[styles.toast, appear]}>
				<Text style={styles.message} numberOfLines={1}>
					{message}
				</Text>
				{secondAction && (
					<TextButton
						label={secondAction.label}
						onPress={secondAction.onPress}
					/>
				)}
				<TextButton label={action} tone="strong" onPress={onAction} />
				{onDismiss && (
					<IconButton icon="close" label="Dismiss" onPress={onDismiss} />
				)}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	// A plain view carries `box-none`: on web, Reanimated drops it from an
	// animated view's inline style.
	area: {
		position: "absolute",
		alignItems: "center",
		paddingHorizontal: space.md,
		pointerEvents: "box-none",
	},
	toast: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: 44,
		paddingLeft: space.md,
		paddingRight: space.md,
		borderRadius: radii.medium,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
		boxShadow: floatingShadow,
	},
	message: {
		...typography.label,
		flexShrink: 1,
		color: colors.textPrimary,
	},
});
