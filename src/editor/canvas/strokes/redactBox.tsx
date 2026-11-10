import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import {
	BackdropFilter,
	Group,
	ImageFilter,
	Rect,
	rect,
} from "react-native-skia";
import { colors } from "@/ui/theme";
import { rectFromCorners } from "../../document/geometry";
import { identityTransform } from "../../layers/base";
import { redactionFilter } from "../../layers/redaction/RedactionLayerView";
import type { RedactionEffect } from "../../layers/redaction/redaction";
import type { CanvasTool } from "../canvasTool";
import { SELECTION_STROKE_PX, useScreenPixels } from "../SelectionOverlay";
import {
	dragEnds,
	type LiveStroke,
	type StrokeKind,
	unlanded,
} from "./strokeTypes";

type RedactBoxTool = Extract<CanvasTool, { type: "redactBox" }>;

/**
 * A redaction's box as it's dragged out, in document space, outlined so a
 * blur or pixelation over a plain area still shows where it goes.
 */
function LiveBox({
	stroke,
	effect,
	viewScale,
}: {
	stroke: LiveStroke;
	effect: RedactionEffect;
	viewScale: DerivedValue<number>;
}) {
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const box = useDerivedValue(() => {
		const points = unlanded(stroke);
		if (points.length === 0) return rect(0, 0, 0, 0);
		const [from, to] = dragEnds(points);
		return rectFromCorners(from, to);
	});
	return (
		<Group>
			{effect.type === "solid" ? (
				<Rect rect={box} color={effect.color} />
			) : (
				<BackdropFilter
					clip={box}
					filter={
						<ImageFilter filter={redactionFilter(effect, identityTransform)} />
					}
				/>
			)}
			<Rect
				rect={box}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
		</Group>
	);
}

export const redactBoxStrokeKind: StrokeKind<RedactBoxTool> = {
	reaches: () => false,
	startsLayer: () => true,
	renderNewLayer: (stroke, tool, viewScale) => (
		<LiveBox stroke={stroke} effect={tool.effect} viewScale={viewScale} />
	),
};
