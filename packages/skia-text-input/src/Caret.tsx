import { useEffect } from "react";
import {
	cancelAnimation,
	type DerivedValue,
	useDerivedValue,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { Group, Rect, rect as skRect } from "react-native-skia";
import type { TextRect } from "./caretLayout.ts";

/**
 * The props of a `Caret`.
 * - `rect`: where it stands, from `CaretLayout.caretRect`, in the space it's
 *   drawn in.
 * - `pixel`: one screen pixel in that space, so the caret keeps its width at
 *   any zoom.
 * - `color`, and `haloColor`, drawn around it to stand out on any
 *   background.
 * - `width` and `halo`, in screen pixels; `blinkMs`, how long it stays on,
 *   then off.
 */
export type CaretProps = {
	rect: TextRect;
	pixel: DerivedValue<number>;
	color?: string;
	haloColor?: string;
	width?: number;
	halo?: number;
	blinkMs?: number;
};

/**
 * A text caret, drawn in a Skia canvas. It blinks from the moment it mounts:
 * key it by where it is and the text, so it holds still while it moves and
 * while typing.
 */
export function Caret({
	rect: { x, y, height },
	pixel,
	color = "#0A84FF",
	haloColor = "rgba(0, 0, 0, 0.22)",
	width = 2,
	halo = 1,
	blinkMs = 530,
}: CaretProps) {
	const bar = useDerivedValue(() => {
		const barWidth = width * pixel.value;
		return skRect(x - barWidth / 2, y, barWidth, height);
	});
	const haloRect = useDerivedValue(() => {
		const margin = halo * pixel.value;
		const haloWidth = width * pixel.value + margin * 2;
		return skRect(
			x - haloWidth / 2,
			y - margin,
			haloWidth,
			height + margin * 2,
		);
	});
	const opacity = useSharedValue(1);
	useEffect(() => {
		opacity.value = withSequence(
			withTiming(1, { duration: 0 }),
			withRepeat(
				withSequence(
					withDelay(blinkMs, withTiming(0, { duration: 0 })),
					withDelay(blinkMs, withTiming(1, { duration: 0 })),
				),
				-1,
			),
		);
		return () => cancelAnimation(opacity);
	}, [opacity, blinkMs]);
	return (
		<Group opacity={opacity}>
			<Rect rect={haloRect} color={haloColor} />
			<Rect rect={bar} color={color} />
		</Group>
	);
}
