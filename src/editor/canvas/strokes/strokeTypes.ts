import type { ReactNode } from "react";
import type { DerivedValue, SharedValue } from "react-native-reanimated";
import type { SkPath } from "react-native-skia";
import type { Point } from "../../document/geometry";
import type { ColorMatrix } from "../../layers/image/adjustments";
import type { Layer } from "../../layers/layer";
import type { CanvasTool } from "../canvasTool";
import type { LiveTransform } from "../liveTransform";

/**
 * A stroke being painted with a tool, drawn live until the document has it:
 * - `points` so far in document space, and its `id`; a box runs from its
 *   first point to its last.
 * - `landedId`: once the document has the stroke, the scene stops drawing
 *   it live in the same update that draws it from the document. Clearing
 *   `points` instead would blink: a shared value redraws the canvas before
 *   the canvas's own renderer has the new document.
 * - `reaches`: the layers it's drawn into as it's painted.
 * - `startsLayer`: drawn over everything instead, as it will start a layer.
 * - `erasePath`: the Eraser's line, built once for every drawing it reaches.
 * - `nearDrawings`: the drawings the Eraser's line has come near, by id,
 *   which it joins as it's painted; the rest stay without a saved layer.
 * - `crossed`: the shapes the Eraser has crossed, dimmed until it lifts.
 * - `crossedStrokes`: the Stroke eraser's strokes touched so far, by
 *   drawing id, dimmed until it lifts.
 * - `hoveredStroke`: on web, the stroke a Stroke eraser click would take.
 */
export type LiveStroke = {
	tool: CanvasTool;
	points: SharedValue<number[]>;
	id: SharedValue<number>;
	landedId: number;
	reaches: (layer: Layer) => boolean;
	startsLayer: boolean;
	erasePath: DerivedValue<SkPath> | null;
	nearDrawings: SharedValue<Record<string, boolean>> | null;
	crossed: SharedValue<string[]> | null;
	crossedStrokes: SharedValue<Record<string, number[]>> | null;
	hoveredStroke: DerivedValue<HoveredStroke | null> | null;
};

/** A drawing's stroke, by its index in the drawing's strokes. */
export type HoveredStroke = { id: string; index: number };

/**
 * How far a mark out of reach fades: a shape the Eraser crosses, before it
 * goes, and every other drawing and shape while the Eraser keeps to one.
 */
export const DIMMED_OPACITY = 0.33;

export type LayerStrokeProps = {
	layer: Layer;
	uri?: string;
	stroke: LiveStroke;
	live: LiveTransform;
	matrix?: DerivedValue<ColorMatrix>;
	selectionColor: string | undefined;
	dimmed: boolean;
	onImageError: (error: unknown) => void;
};

export type StrokeOverlayProps<T extends CanvasTool = CanvasTool> = {
	tool: T;
	ring: {
		x: DerivedValue<number>;
		y: DerivedValue<number>;
		shown: SharedValue<boolean>;
	};
	scale: DerivedValue<number>;
	stroke: LiveStroke | null;
	selectionColor: string;
};

/**
 * What one kind of canvas tool does while its stroke is being painted:
 * which existing layers it joins, whether it starts a new layer over the
 * scene, and how it draws in either place.
 */
export type StrokeKind<T extends CanvasTool = CanvasTool> = {
	reaches: (tool: T, layer: Layer, selectedId: string | null) => boolean;
	startsLayer: (selectedId: string | null) => boolean;
	renderInLayer?: (props: LayerStrokeProps & { tool: T }) => ReactNode;
	renderNewLayer?: (
		stroke: LiveStroke,
		tool: T,
		viewScale: DerivedValue<number>,
	) => ReactNode;
	renderOverlay?: (props: StrokeOverlayProps<T>) => ReactNode;
};

// Whatever of a stroke is still to land in the document (see `LiveStroke`).
// A worklet, as the live views read it as the stroke grows.
export function unlanded(stroke: LiveStroke): number[] {
	"worklet";
	return stroke.id.value > stroke.landedId ? stroke.points.value : [];
}

// Where a drag's points began and where they are now.
export function dragEnds(points: number[]): [Point, Point] {
	"worklet";
	return [
		{ x: points[0], y: points[1] },
		{ x: points[points.length - 2], y: points[points.length - 1] },
	];
}
