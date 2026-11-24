import { useDerivedValue } from "react-native-reanimated";
import { Group, Paint } from "react-native-skia";
import {
	BrushStroke,
	inkBounds,
	roundedEndsOutline,
	strokePath,
} from "../../layers/drawing/DrawingLayerView";
import {
	type PenBrush,
	ROUNDED_END,
	strokeEnds,
	strokeOpacity,
	visibleReach,
} from "../../layers/drawing/drawing";
import { LayerContent } from "../../layers/LayerContent";
import { toInverseTransformList } from "../../layers/layerTransform";
import type { CanvasTool } from "../canvasTool";
import { BrushRing } from "./BrushRing";
import {
	DIMMED_OPACITY,
	type LiveStroke,
	type StrokeKind,
	unlanded,
} from "./strokeTypes";
import { noted, useFreeReplaced, usePathsBuilt } from "./useFreeReplaced";

type DrawTool = Extract<CanvasTool, { type: "draw" }>;

/**
 * A stroke as it's being painted, in document space. Keyed by `landedId`, so
 * a landed stroke gives way to the document's copy in one update.
 */
function LivePath({
	stroke,
	brush,
	full = false,
}: {
	stroke: LiveStroke;
	brush: PenBrush;
	full?: boolean;
}) {
	const built = usePathsBuilt();
	const path = useDerivedValue(() =>
		noted(built, strokePath(unlanded(stroke))),
	);
	const rounded = strokeEnds(brush) === "rounded";
	const { width } = brush;
	// Built on the UI thread with each frame's path.
	const outline = useDerivedValue(
		() =>
			(rounded && noted(built, roundedEndsOutline(path.value, width))) ||
			path.value,
		[path, rounded, width],
	);
	useFreeReplaced(built, path, outline);
	const faded = brush.tip === "neon" && strokeOpacity(brush) < 1;
	const reach = visibleReach(brush);
	// Only a faded neon stroke saves a layer to bound.
	const bounds = useDerivedValue(
		() => (faded ? inkBounds(path.value, reach) : undefined),
		[path, faded, reach],
	);
	return (
		<BrushStroke
			path={path}
			outline={rounded ? outline : undefined}
			bounds={faded ? bounds : undefined}
			brush={brush}
			full={full}
		/>
	);
}

// How round a pen's size ring is: its ends' shape.
const RING_CORNER = { round: 0.5, rounded: ROUNDED_END, square: 0 };

export const drawStrokeKind: StrokeKind<DrawTool> = {
	renderOverlay: ({ tool, ring, scale, stroke, selectionColor }) => (
		<BrushRing
			ring={ring}
			scale={scale}
			stroke={stroke}
			color={selectionColor}
			width={tool.brush.width}
			corner={RING_CORNER[strokeEnds(tool.brush)]}
		/>
	),
	reaches: (_tool, layer, selectedId) => layer.id === selectedId,
	startsLayer: (selectedId) => selectedId === null,
	renderInLayer: ({
		layer,
		uri,
		stroke,
		tool,
		matrix,
		selectionColor,
		dimmed,
		onImageError,
	}) => (
		<LayerContent
			layer={layer}
			uri={uri}
			stroke={
				<Group transform={toInverseTransformList(layer.transform)}>
					<LivePath
						key={stroke.landedId}
						stroke={stroke}
						brush={tool.brush}
						full={tool.brush.tip === "marker"}
					/>
				</Group>
			}
			matrix={matrix}
			selectionColor={selectionColor}
			opacity={dimmed ? DIMMED_OPACITY : undefined}
			onImageError={onImageError}
		/>
	),
	renderNewLayer: (stroke, tool) => {
		const path = (
			<LivePath
				stroke={stroke}
				brush={tool.brush}
				full={tool.brush.tip === "marker"}
			/>
		);
		// A new highlighter multiplies as it's drawn. It lands as its own
		// layer, which multiplies the same way.
		return tool.brush.tip === "marker" ? (
			<Group layer={<Paint blendMode="multiply" />}>{path}</Group>
		) : (
			path
		);
	},
};
