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
import type { RedactionBoxPlacement } from "@/model/layers/redaction";
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
// A detected region's check mark's radius, in screen pixels: a share of the
// region's shorter side on screen, within these bounds, so marks on small
// faces don't cover them or each other. A region narrower than
// `MARKER_HIDDEN_BELOW_PX` gets none: its fill and outline show its state.
const MARKER_MIN_PX = 4;
const MARKER_MAX_PX = 8;
const MARKER_SHARE = 0.2;
const MARKER_HIDDEN_BELOW_PX = 12;

export type DetectionOverlayRegion = RedactionBoxPlacement & {
	sourceIndex: number;
	selected: boolean;
};

/**
 * `px` screen pixels in document units, following the view's scale as a
 * zoom changes it.
 */
export function useScreenPixels(viewScale: DerivedValue<number>, px: number) {
	return useDerivedValue(() => px / viewScale.value, [viewScale, px]);
}

/**
 * A temporary detector proposal, outlined until the user applies it, with a
 * mark in its corner that's checked while it's chosen.
 */
export function DetectionOutline({
	region,
	viewScale,
}: {
	region: DetectionOverlayRegion;
	viewScale: DerivedValue<number>;
}) {
	const { width, height, transform, selected } = region;
	const box = rect(-width / 2, -height / 2, width, height);
	const marker = useDerivedValue(() => {
		const disc = Skia.PathBuilder.Make();
		const check = Skia.PathBuilder.Make();
		const shortSide = Math.min(width, height) * viewScale.value;
		if (shortSide < MARKER_HIDDEN_BELOW_PX) {
			return { disc: disc.build(), check: check.build() };
		}
		const px = Math.min(
			MARKER_MAX_PX,
			Math.max(MARKER_MIN_PX, shortSide * MARKER_SHARE),
		);
		const radius = px / viewScale.value;
		const x = width / 2 - radius * 0.2;
		const y = -height / 2 + radius * 0.2;
		disc.addCircle(x, y, radius);
		check.moveTo(x - radius * 0.42, y);
		check.lineTo(x - radius * 0.1, y + radius * 0.34);
		check.lineTo(x + radius * 0.48, y - radius * 0.34);
		return { disc: disc.build(), check: check.build() };
	}, [viewScale, width, height]);
	const disc = useDerivedValue(() => marker.value.disc);
	const check = useDerivedValue(() => marker.value.check);
	const outline = useScreenPixels(viewScale, selected ? 2 : 1.25);
	const ring = useScreenPixels(viewScale, 1.25);
	const tick = useScreenPixels(viewScale, 2);
	return (
		<Group transform={toTransformList(transform)}>
			<Rect
				rect={box}
				color={selected ? colors.selectionSoft : "rgba(0, 0, 0, 0.18)"}
			/>
			<Rect
				rect={box}
				color={selected ? colors.selection : colors.textSecondary}
				style="stroke"
				strokeWidth={outline}
			/>
			<Path path={disc} color={selected ? colors.selection : colors.surface} />
			<Path
				path={disc}
				color={selected ? colors.selection : colors.textSecondary}
				style="stroke"
				strokeWidth={ring}
			/>
			{selected && (
				<Path
					path={check}
					color={colors.onSelection}
					style="stroke"
					strokeWidth={tick}
					strokeCap="round"
					strokeJoin="round"
				/>
			)}
		</Group>
	);
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
