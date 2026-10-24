import type { EditorDocument } from "@model/document.ts";
import type { Point } from "@model/geometry.ts";
import type { DrawingLayer } from "@model/layers/drawing.ts";
import { drawingBox } from "@model/strokes.ts";
import { type PointerEvent, useRef, useState } from "react";
import {
	DocumentScene,
	Selection,
	StrokesView,
	strokePath,
} from "./layerViews.tsx";

export type StrokeMode = "pen" | "eraser" | "probe";

const MARGIN = 40;
// Closer than this, a pointer move adds no point: it would only make the
// stroke longer to store.
const MIN_STEP = 3;

/**
 * The canvas, drawn on with the pointer. A finished stroke goes to
 * `onStroke` in document space, as the editor's draw gesture hands it to
 * the store; in probe mode, presses go to `onProbe`.
 */
export function StrokesStage({
	document,
	layer,
	mode,
	brush,
	origin,
	probe,
	onStroke,
	onProbe,
}: {
	document: EditorDocument;
	layer: DrawingLayer | null;
	mode: StrokeMode;
	brush: { color: string; width: number };
	// Where the drawing's origin was before its last stroke recentered it.
	origin: { from: Point; to: Point } | null;
	probe: { point: Point; selects: boolean; reach: number } | null;
	onStroke: (points: number[]) => void;
	onProbe: (point: Point) => void;
}) {
	const svg = useRef<SVGSVGElement>(null);
	const [live, setLive] = useState<number[] | null>(null);
	const drawing = useRef(false);

	const toDocument = (event: PointerEvent): Point => {
		const matrix = svg.current?.getScreenCTM()?.inverse();
		if (!matrix) return { x: 0, y: 0 };
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
			matrix,
		);
		return { x: Math.round(point.x), y: Math.round(point.y) };
	};

	const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		drawing.current = true;
		const point = toDocument(event);
		if (mode === "probe") onProbe(point);
		else setLive([point.x, point.y]);
	};

	const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
		if (!drawing.current) return;
		const point = toDocument(event);
		if (mode === "probe") {
			onProbe(point);
			return;
		}
		setLive((points) => {
			if (!points) return points;
			const x = points[points.length - 2];
			const y = points[points.length - 1];
			return Math.hypot(point.x - x, point.y - y) < MIN_STEP
				? points
				: [...points, point.x, point.y];
		});
	};

	const onPointerUp = () => {
		drawing.current = false;
		if (live) onStroke(live);
		setLive(null);
	};

	const { width, height } = document;
	return (
		<svg
			ref={svg}
			className={`stage strokes-stage mode-${mode}`}
			viewBox={`${-MARGIN} ${-MARGIN} ${width + MARGIN * 2} ${height + MARGIN * 2}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={() => {
				drawing.current = false;
				setLive(null);
			}}
			role="img"
			aria-label="The canvas, to draw on"
		>
			<DocumentScene document={document} />
			{layer && <Selection layer={layer} />}
			{origin && (
				<g className="origin-move">
					<line
						className="origin-path"
						x1={origin.from.x}
						y1={origin.from.y}
						x2={origin.to.x}
						y2={origin.to.y}
						markerEnd="url(#origin-arrow)"
					/>
					<circle
						className="origin-from"
						cx={origin.from.x}
						cy={origin.from.y}
						r={9}
					/>
					<defs>
						<marker
							id="origin-arrow"
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="6"
							markerHeight="6"
							orient="auto"
						>
							<path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
						</marker>
					</defs>
				</g>
			)}
			{live && (
				<path
					className={mode === "eraser" ? "live-eraser" : undefined}
					d={strokePath(live)}
					fill="none"
					stroke={mode === "eraser" ? "rgba(255, 255, 255, 0.7)" : brush.color}
					strokeWidth={brush.width}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			)}
			{probe && (
				<g className={probe.selects ? "probe hit" : "probe"}>
					<circle
						className="probe-reach"
						cx={probe.point.x}
						cy={probe.point.y}
						r={probe.reach}
					/>
					<circle cx={probe.point.x} cy={probe.point.y} r={9} />
				</g>
			)}
		</svg>
	);
}

/**
 * A drawing's strokes as they're stored: in its own space, around its
 * origin, before its transform turns, scales, or moves them.
 */
export function StoredStrokesView({ layer }: { layer: DrawingLayer }) {
	const box = drawingBox(layer);
	const halfWidth = Math.max(box.halfWidth, 60) + 70;
	const halfHeight = Math.max(box.halfHeight, 60) + 70;
	const label = Math.max(halfWidth, halfHeight) * 0.06;
	return (
		<svg
			className="stage layer-stage stored-stage"
			viewBox={`${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
			role="img"
			aria-label="The drawing's strokes in its own space"
		>
			<rect
				className="stored-box"
				x={-box.halfWidth}
				y={-box.halfHeight}
				width={box.halfWidth * 2}
				height={box.halfHeight * 2}
				vectorEffect="non-scaling-stroke"
			/>
			<StrokesView strokes={layer.strokes} />
			<g className="stored-axes">
				<line
					x1={-halfWidth}
					x2={halfWidth}
					y1={0}
					y2={0}
					vectorEffect="non-scaling-stroke"
				/>
				<line
					y1={-halfHeight}
					y2={halfHeight}
					x1={0}
					x2={0}
					vectorEffect="non-scaling-stroke"
				/>
				<text x={label * 0.6} y={-label * 0.6} style={{ fontSize: label }}>
					(0, 0)
				</text>
			</g>
		</svg>
	);
}
