import {
	type Box,
	type Point,
	type Transform,
	toDocumentSpace,
	transformMatrix,
} from "@model/geometry.ts";
import { type PointerEvent, useRef } from "react";

export const DOCUMENT = { width: 1200, height: 900 };
export const IMAGE = { width: 400, height: 300 };
export const IMAGE_BOX: Box = {
	halfWidth: IMAGE.width / 2,
	halfHeight: IMAGE.height / 2,
};

const MARGIN = 70;
const KNOB_REACH = 34;

function steps(to: number, step: number): number[] {
	return Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => i * step);
}

function svgMatrix(transform: Transform): string {
	// SVG's matrix(a b c d e f) is the same affine map as the model's Matrix.
	const { a, b, c, d, tx, ty } = transformMatrix(transform);
	return `matrix(${a} ${b} ${c} ${d} ${tx} ${ty})`;
}

/** A stand-in photo, lopsided so its turns and stretches are easy to read. */
function Photo() {
	const { width, height } = IMAGE;
	return (
		<g>
			<rect
				x={-width / 2}
				y={-height / 2}
				width={width}
				height={height}
				fill="url(#sky)"
			/>
			<polygon
				points={`${-width / 2},60 ${-60},-40 ${30},40 ${100},-10 ${width / 2},50 ${width / 2},${height / 2} ${-width / 2},${height / 2}`}
				fill="#6F8F7A"
			/>
			<rect
				x={-width / 2}
				y={80}
				width={width}
				height={height / 2 - 80}
				fill="#E2C38E"
			/>
			<circle cx={-120} cy={-75} r={34} fill="#FF9F43" />
		</g>
	);
}

function Defs() {
	return (
		<defs>
			<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#7DB4F5" />
				<stop offset="1" stopColor="#F6D9B8" />
			</linearGradient>
			<clipPath id="canvas-clip">
				<rect width={DOCUMENT.width} height={DOCUMENT.height} />
			</clipPath>
			<marker
				id="arrow"
				viewBox="0 0 10 10"
				refX="8"
				refY="5"
				markerWidth="7"
				markerHeight="7"
				orient="auto-start-reverse"
			>
				<path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
			</marker>
		</defs>
	);
}

function Axis({
	from,
	to,
	label,
	labelAt,
	className,
	fontSize,
}: {
	from: Point;
	to: Point;
	label: string;
	labelAt: Point;
	className: string;
	fontSize?: number;
}) {
	return (
		<g className={className}>
			<line
				x1={from.x}
				y1={from.y}
				x2={to.x}
				y2={to.y}
				markerEnd="url(#arrow)"
				vectorEffect="non-scaling-stroke"
			/>
			<text
				x={labelAt.x}
				y={labelAt.y}
				textAnchor="middle"
				dominantBaseline="middle"
				style={fontSize ? { fontSize } : undefined}
			>
				{label}
			</text>
		</g>
	);
}

/**
 * The canvas in document space. Dragging the center knob moves the layer;
 * pressing anywhere else moves the probe point.
 */
export function DocumentStage({
	transform,
	probe,
	hit,
	onMove,
	onProbe,
}: {
	transform: Transform;
	probe: Point;
	hit: boolean;
	onMove: (center: Point) => void;
	onProbe: (point: Point) => void;
}) {
	const svg = useRef<SVGSVGElement>(null);
	const drag = useRef<{ kind: "layer" | "probe"; offset: Point } | null>(null);

	const toDocument = (event: PointerEvent): Point => {
		const matrix = svg.current?.getScreenCTM()?.inverse();
		if (!matrix) return { x: 0, y: 0 };
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
			matrix,
		);
		return { x: point.x, y: point.y };
	};

	const clamp = (value: number, min: number, max: number) =>
		Math.round(Math.min(max, Math.max(min, value)));

	const apply = (point: Point) => {
		const current = drag.current;
		if (!current) return;
		const x = point.x + current.offset.x;
		const y = point.y + current.offset.y;
		if (current.kind === "layer") {
			onMove({
				x: clamp(x, 0, DOCUMENT.width),
				y: clamp(y, 0, DOCUMENT.height),
			});
		} else {
			onProbe({
				x: clamp(x, -MARGIN + 10, DOCUMENT.width + MARGIN - 10),
				y: clamp(y, -MARGIN + 10, DOCUMENT.height + MARGIN - 10),
			});
		}
	};

	const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
		const point = toDocument(event);
		const onKnob =
			Math.hypot(point.x - transform.x, point.y - transform.y) <= KNOB_REACH;
		drag.current = onKnob
			? {
					kind: "layer",
					offset: { x: transform.x - point.x, y: transform.y - point.y },
				}
			: { kind: "probe", offset: { x: 0, y: 0 } };
		event.currentTarget.setPointerCapture(event.pointerId);
		apply(point);
	};

	const center = { x: transform.x, y: transform.y };
	const xAxisEnd = toDocumentSpace(transform, {
		x: IMAGE.width / 2 + 60,
		y: 0,
	});
	const xLabel = toDocumentSpace(transform, { x: IMAGE.width / 2 + 95, y: 0 });
	const yAxisEnd = toDocumentSpace(transform, {
		x: 0,
		y: IMAGE.height / 2 + 60,
	});
	const yLabel = toDocumentSpace(transform, { x: 0, y: IMAGE.height / 2 + 95 });
	const matrix = svgMatrix(transform);

	const xTicks = steps(DOCUMENT.width, 100);
	const yTicks = steps(DOCUMENT.height, 100);

	return (
		<svg
			ref={svg}
			className="stage document-stage"
			viewBox={`${-MARGIN} ${-MARGIN} ${DOCUMENT.width + MARGIN * 2} ${DOCUMENT.height + MARGIN * 2}`}
			onPointerDown={onPointerDown}
			onPointerMove={(event) => apply(toDocument(event))}
			onPointerUp={() => {
				drag.current = null;
			}}
			role="img"
			aria-label="The canvas in document space, with a layer and a probe point"
		>
			<Defs />
			<rect
				className="canvas"
				width={DOCUMENT.width}
				height={DOCUMENT.height}
			/>
			<g className="grid">
				{xTicks.map((x) => (
					<line key={`x${x}`} x1={x} x2={x} y1={0} y2={DOCUMENT.height} />
				))}
				{yTicks.map((y) => (
					<line key={`y${y}`} y1={y} y2={y} x1={0} x2={DOCUMENT.width} />
				))}
			</g>
			<g className="tick-labels">
				{xTicks
					.filter((x) => x % 200 === 0)
					.map((x) => (
						<text key={`x${x}`} x={x} y={-22} textAnchor="middle">
							{x}
						</text>
					))}
				{yTicks
					.filter((y) => y % 200 === 0)
					.map((y) => (
						<text
							key={`y${y}`}
							x={-18}
							y={y}
							textAnchor="end"
							dominantBaseline="middle"
						>
							{y}
						</text>
					))}
			</g>

			{/* Outside the canvas a layer is cropped: show it faintly there. */}
			<g opacity={0.28} transform={matrix}>
				<Photo />
			</g>
			<g clipPath="url(#canvas-clip)">
				<g transform={matrix}>
					<Photo />
				</g>
			</g>
			<g transform={matrix}>
				<rect
					className="layer-outline"
					x={-IMAGE.width / 2}
					y={-IMAGE.height / 2}
					width={IMAGE.width}
					height={IMAGE.height}
					vectorEffect="non-scaling-stroke"
				/>
			</g>

			<Axis
				className="axis axis-x"
				from={center}
				to={xAxisEnd}
				label="+x"
				labelAt={xLabel}
			/>
			<Axis
				className="axis axis-y"
				from={center}
				to={yAxisEnd}
				label="+y"
				labelAt={yLabel}
			/>

			{/* Down (or up) from the center by dy, then across by dx. */}
			<g className="legs">
				<line x1={center.x} y1={center.y} x2={center.x} y2={probe.y} />
				<line x1={center.x} y1={probe.y} x2={probe.x} y2={probe.y} />
				<text
					x={center.x + (probe.x >= center.x ? -14 : 14)}
					y={(center.y + probe.y) / 2}
					textAnchor={probe.x >= center.x ? "end" : "start"}
					dominantBaseline="middle"
				>
					dy
				</text>
				<text
					x={(center.x + probe.x) / 2}
					y={probe.y + (probe.y <= center.y ? -16 : 32)}
					textAnchor="middle"
				>
					dx
				</text>
			</g>

			<g className="knob">
				<circle cx={center.x} cy={center.y} r={16} />
				<text x={center.x + 24} y={center.y - 24}>
					transform.x, y
				</text>
			</g>

			<g className={hit ? "probe hit" : "probe"}>
				<line x1={probe.x - 26} x2={probe.x + 26} y1={probe.y} y2={probe.y} />
				<line x1={probe.x} x2={probe.x} y1={probe.y - 26} y2={probe.y + 26} />
				<circle cx={probe.x} cy={probe.y} r={11} />
			</g>
		</svg>
	);
}

/**
 * The same probe in the layer's own space: its center at the origin, its
 * rotation and scale undone, so its box is upright and unscaled.
 */
export function LayerSpaceView({ local, hit }: { local: Point; hit: boolean }) {
	const halfWidth = Math.max(IMAGE_BOX.halfWidth + 110, Math.abs(local.x) + 60);
	const halfHeight = Math.max(
		IMAGE_BOX.halfHeight + 110,
		Math.abs(local.y) + 60,
	);
	const fontSize = Math.max(halfWidth, halfHeight * 1.3) * 0.075;
	const { halfWidth: boxW, halfHeight: boxH } = IMAGE_BOX;

	return (
		<svg
			className="stage layer-stage"
			viewBox={`${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
			role="img"
			aria-label={`The probe in layer space, at ${local.x.toFixed(1)}, ${local.y.toFixed(1)}`}
		>
			<Defs />
			<Photo />
			<rect
				className="layer-outline"
				x={-boxW}
				y={-boxH}
				width={boxW * 2}
				height={boxH * 2}
				vectorEffect="non-scaling-stroke"
			/>
			<Axis
				className="axis axis-x"
				from={{ x: -halfWidth + 10, y: 0 }}
				to={{ x: halfWidth - 10, y: 0 }}
				label="+x"
				labelAt={{ x: halfWidth - fontSize * 1.1, y: -fontSize * 0.9 }}
				fontSize={fontSize}
			/>
			<Axis
				className="axis axis-y"
				from={{ x: 0, y: -halfHeight + 10 }}
				to={{ x: 0, y: halfHeight - 10 }}
				label="+y"
				labelAt={{ x: fontSize * 1.1, y: halfHeight - fontSize }}
				fontSize={fontSize}
			/>
			<g className="dimension" style={{ fontSize: fontSize * 0.85 }}>
				<line
					x1={0}
					y1={-boxH - fontSize * 0.8}
					x2={boxW}
					y2={-boxH - fontSize * 0.8}
					vectorEffect="non-scaling-stroke"
				/>
				<text x={boxW / 2} y={-boxH - fontSize * 1.3} textAnchor="middle">
					halfWidth {boxW}
				</text>
				<line
					x1={-boxW - fontSize * 0.8}
					y1={0}
					x2={-boxW - fontSize * 0.8}
					y2={boxH}
					vectorEffect="non-scaling-stroke"
				/>
				<text
					transform={`translate(${-boxW - fontSize * 1.3} ${boxH / 2}) rotate(-90)`}
					textAnchor="middle"
				>
					halfHeight {boxH}
				</text>
			</g>
			<g className="legs">
				<line
					x1={local.x}
					y1={0}
					x2={local.x}
					y2={local.y}
					vectorEffect="non-scaling-stroke"
				/>
				<line
					x1={0}
					y1={local.y}
					x2={local.x}
					y2={local.y}
					vectorEffect="non-scaling-stroke"
				/>
			</g>
			<g className={hit ? "probe hit" : "probe"}>
				<circle
					cx={local.x}
					cy={local.y}
					r={fontSize * 0.5}
					vectorEffect="non-scaling-stroke"
				/>
			</g>
		</svg>
	);
}
