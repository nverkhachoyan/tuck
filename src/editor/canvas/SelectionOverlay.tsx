import {
	Group,
	Path,
	Rect,
	rect,
	Shadow,
	Skia,
} from "@shopify/react-native-skia";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import type { EditorDocument } from "@/model/document";
import type { Layer } from "@/model/layers/layer";
import { toTransformList } from "@/render/layerTransform";
import { colors } from "@/ui/theme";
import { handleSides } from "./handleGeometry";
import { handleMetrics, shownHandles } from "./handleMetrics";
import { layerBounds } from "./layerBounds";
import type { LiveTransform } from "./liveTransform";

export const SELECTION_STROKE_PX = 1.5;
// Under the selection's lines, so they read on light photos as on dark ones.
// Crop's frame uses the same width.
export const SELECTION_HALO_PX = 3.5;
export const SELECTION_HALO = "rgba(0, 0, 0, 0.22)";

/**
 * `px` screen pixels in document units, following the view's scale as a
 * zoom changes it.
 */
export function useScreenPixels(viewScale: DerivedValue<number>, px: number) {
	return useDerivedValue(() => px / viewScale.value, [viewScale, px]);
}

/**
 * A layer's selection outline where the document has it, with no handles:
 * what a tool acts on, while gestures leave it be.
 */
export function SelectionOutline({
	layer,
	viewScale,
}: {
	layer: Layer;
	viewScale: DerivedValue<number>;
}) {
	const halo = useScreenPixels(viewScale, SELECTION_HALO_PX);
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const { transform } = layer;
	const { halfWidth, halfHeight } = layerBounds(layer);
	const w = halfWidth * transform.scaleX;
	const h = halfHeight * transform.scaleY;
	const box = rect(-w, -h, w * 2, h * 2);
	return (
		<Group transform={toTransformList({ ...transform, scaleX: 1, scaleY: 1 })}>
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

/** The document's edge or center lines the dragged layer has snapped onto. */
export function SnapGuides({
	document,
	viewScale,
	live,
}: {
	document: EditorDocument;
	viewScale: DerivedValue<number>;
	live: LiveTransform;
}) {
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const { width, height } = document;
	const path = useDerivedValue(() => {
		const builder = Skia.PathBuilder.Make();
		const x = live.guideX.value;
		const y = live.guideY.value;
		if (x !== null) {
			builder.moveTo(x, 0);
			builder.lineTo(x, height);
		}
		if (y !== null) {
			builder.moveTo(0, y);
			builder.lineTo(width, y);
		}
		return builder.build();
	}, [width, height]);

	return (
		<Path
			path={path}
			color={colors.selection}
			style="stroke"
			strokeWidth={outline}
		/>
	);
}

/**
 * The selected layer's outline and its corner (scale) and knob (rotate)
 * handles, and a box's side (resize) handles when it resizes freely, drawn
 * from the live values so they follow gestures. The group translates and
 * rotates with the layer but doesn't scale: the scale moves the corners
 * instead, so handles stay the same size on screen.
 */
export function SelectionHandles({
	live,
	viewScale,
}: {
	live: LiveTransform;
	viewScale: DerivedValue<number>;
}) {
	const halo = useScreenPixels(viewScale, SELECTION_HALO_PX);
	const outline = useScreenPixels(viewScale, SELECTION_STROKE_PX);
	const shadowOffset = useScreenPixels(viewScale, 1);
	const shadowBlur = useScreenPixels(viewScale, 3);
	const transform = useDerivedValue(() =>
		toTransformList({
			x: live.x.value,
			y: live.y.value,
			rotation: live.rotation.value,
			scaleX: 1,
			scaleY: 1,
		}),
	);

	// The outline and the stem up to the knob as one path, and the corner
	// dots, side pills, and knob as another.
	const shapes = useDerivedValue(() => {
		const lines = Skia.PathBuilder.Make();
		const handles = Skia.PathBuilder.Make();
		const box = {
			halfWidth: live.halfWidth.value,
			halfHeight: live.halfHeight.value,
		};
		const w = box.halfWidth * live.scaleX.value;
		const h = box.halfHeight * live.scaleY.value;
		lines.addRect(Skia.XYWHRect(-w, -h, w * 2, h * 2));
		const scale = viewScale.value;
		const radius = (handleMetrics.size / scale) * 0.6;
		// Pills along the sides, so they read as pulling that side out.
		const long = radius * 3.2;
		const short = radius * 1.5;
		const shown = shownHandles(
			box,
			live.scaleX.value,
			live.scaleY.value,
			scale,
			live.resizeMode.value,
		);
		for (const handle of shown) {
			if (handle === "rotate") {
				const knobY = -h - handleMetrics.knobOffset / scale;
				handles.addCircle(0, knobY, radius);
				lines.moveTo(0, -h);
				lines.lineTo(0, knobY + radius);
				continue;
			}
			const sides = handleSides(handle);
			const x = sides.x * w;
			const y = sides.y * h;
			// A corner, or a line's end, which moves every way.
			if (
				(sides.x !== 0 && sides.y !== 0) ||
				live.resizeMode.value === "endpoints"
			) {
				handles.addCircle(x, y, radius);
				continue;
			}
			const width = sides.x === 0 ? long : short;
			const height = sides.x === 0 ? short : long;
			handles.addRRect(
				Skia.RRectXY(
					Skia.XYWHRect(x - width / 2, y - height / 2, width, height),
					short / 2,
					short / 2,
				),
			);
		}
		return { lines: lines.build(), handles: handles.build() };
	}, [viewScale]);
	const lines = useDerivedValue(() => shapes.value.lines);
	const handles = useDerivedValue(() => shapes.value.handles);

	return (
		<Group transform={transform}>
			<Path
				path={lines}
				color={SELECTION_HALO}
				style="stroke"
				strokeWidth={halo}
			/>
			<Path
				path={lines}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
			<Path path={handles} color="#FFFFFF">
				<Shadow
					dx={0}
					dy={shadowOffset}
					blur={shadowBlur}
					color="rgba(0, 0, 0, 0.4)"
				/>
			</Path>
			<Path
				path={handles}
				color={colors.selection}
				style="stroke"
				strokeWidth={outline}
			/>
		</Group>
	);
}
