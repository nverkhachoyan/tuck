import { useDerivedValue } from "react-native-reanimated";
import { RoundedRect } from "react-native-skia";
import type { StrokeOverlayProps } from "./strokeTypes";

const RING_PX = 1.5;

/**
 * On web, a brush's size under the mouse, hidden while it drags:
 * - `width` is the brush's, in document units, scaled with the view.
 * - `corner` rounds its corners, as a share of `width`: half is a circle,
 *   a quarter a highlighter's rounded end, 0 a square one.
 */
export function BrushRing({
	ring,
	scale,
	stroke,
	color,
	width,
	corner = 0.5,
}: Omit<StrokeOverlayProps, "tool" | "selectionColor"> & {
	color: string;
	width: number;
	corner?: number;
}) {
	const side = useDerivedValue(() => width * scale.value, [width, scale]);
	const x = useDerivedValue(() => ring.x.value - side.value / 2);
	const y = useDerivedValue(() => ring.y.value - side.value / 2);
	const r = useDerivedValue(() => side.value * corner, [side, corner]);
	const strokeId = stroke?.id ?? null;
	const strokePoints = stroke?.points ?? null;
	const landedId = stroke?.landedId ?? 0;
	const shown = ring.shown;
	const opacity = useDerivedValue(() => {
		const dragging =
			strokeId !== null &&
			strokePoints !== null &&
			strokeId.value > landedId &&
			strokePoints.value.length > 0;
		return shown.value && !dragging && width > 0 ? 1 : 0;
	}, [strokeId, strokePoints, landedId, width, shown]);

	if (width <= 0) return null;
	return (
		<RoundedRect
			x={x}
			y={y}
			width={side}
			height={side}
			r={r}
			opacity={opacity}
			style="stroke"
			strokeWidth={RING_PX}
			color={color}
		/>
	);
}
