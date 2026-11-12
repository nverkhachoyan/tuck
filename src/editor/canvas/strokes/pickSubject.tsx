import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import { Group, Rect, rect } from "react-native-skia";
import { colors } from "@/ui/theme";
import { rectFromCorners } from "../../document/geometry";
import type { CanvasTool } from "../canvasTool";
import {
	SELECTION_HALO,
	SELECTION_HALO_PX,
	SELECTION_STROKE_PX,
	useScreenPixels,
} from "../SelectionOverlay";
import { TAP_SLOP_PX } from "../strokeIntent";
import {
	dragEnds,
	type LiveStroke,
	type StrokeKind,
	unlanded,
} from "./strokeTypes";

type PickSubjectTool = Extract<CanvasTool, { type: "pickSubject" }>;

/**
 * The box dragged around an object to select it, outlined over a halo with
 * no fill, so the photo under it stays readable. Nothing shows while the
 * drag could still be a tap.
 */
function LiveBox({
	stroke,
	viewScale,
}: {
	stroke: LiveStroke;
	viewScale: DerivedValue<number>;
}) {
	const halo = useScreenPixels(viewScale, SELECTION_HALO_PX);
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const box = useDerivedValue(() => {
		const points = unlanded(stroke);
		if (points.length === 0) return rect(0, 0, 0, 0);
		const [from, to] = dragEnds(points);
		const box = rectFromCorners(from, to);
		const size = Math.max(box.width, box.height) * viewScale.value;
		return size > TAP_SLOP_PX ? box : rect(0, 0, 0, 0);
	});
	return (
		<Group>
			<Rect
				rect={box}
				color={SELECTION_HALO}
				style="stroke"
				strokeWidth={halo}
			/>
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
		</Group>
	);
}

export const pickSubjectStrokeKind: StrokeKind<PickSubjectTool> = {
	reaches: () => false,
	startsLayer: () => true,
	renderNewLayer: (stroke, _tool, viewScale) => (
		<LiveBox stroke={stroke} viewScale={viewScale} />
	),
};
