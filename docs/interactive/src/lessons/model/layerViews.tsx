import { adjustmentMatrix } from "@model/adjustments.ts";
import type {
	EditorDocument,
	ImageLayer,
	Layer,
	ShapeLayer,
	Stroke,
	TextLayer,
} from "@model/document.ts";
import { isLine } from "@model/document.ts";
import { drawingBox } from "@model/drawing.ts";
import {
	type Box,
	type Transform,
	toDocumentSpace,
	transformMatrix,
} from "@model/geometry.ts";
import { arrowHead, outlineThickness, shapeBox } from "@model/shapes.ts";
import { type ReactNode, useId } from "react";
import { antonLoaded } from "../../ui/fonts.ts";
import { Photo } from "../../ui/Photo.tsx";

export function svgMatrix(transform: Transform): string {
	const { a, b, c, d, tx, ty } = transformMatrix(transform);
	return `matrix(${a} ${b} ${c} ${d} ${tx} ${ty})`;
}

// The app lays text out with a Skia paragraph (`render/textLayerLayout.ts`),
// which a browser can't run without CanvasKit. This measures with a 2D
// canvas instead, wrapping and sizing the block the same way: close, but not
// to the pixel.
const LINE_HEIGHT = 1.2;
let layouts = new WeakMap<TextLayer, TextLayout>();
antonLoaded.then(() => {
	layouts = new WeakMap();
});

type TextLayout = { lines: string[]; width: number; height: number };

let measuring: CanvasRenderingContext2D | null = null;

export function layoutText(layer: TextLayer): TextLayout {
	const cached = layouts.get(layer);
	if (cached) return cached;
	measuring ??= document.createElement("canvas").getContext("2d");
	const context = measuring;
	if (!context) return { lines: [layer.text], width: 0, height: 0 };
	context.font = `${layer.fontSize}px Anton, sans-serif`;
	const measure = (text: string) => context.measureText(text).width;

	const lines: string[] = [];
	for (const paragraph of layer.text.split("\n")) {
		let line = "";
		for (const word of paragraph.split(" ")) {
			const next = line ? `${line} ${word}` : word;
			if (line && measure(next) > layer.maxWidth) {
				lines.push(line);
				line = word;
			} else {
				line = next;
			}
		}
		lines.push(line);
	}
	const longest = Math.max(...lines.map(measure));
	const layout = {
		lines,
		width: Math.min(Math.ceil(longest), layer.maxWidth),
		height: lines.length * layer.fontSize * LINE_HEIGHT,
	};
	layouts.set(layer, layout);
	return layout;
}

/**
 * The box a layer covers in its own space, centered on its origin: the same
 * cases as the editor's `layerBounds`, which places the selection outline,
 * the handles, and hit testing.
 */
export function layerBox(layer: Layer): Box {
	switch (layer.type) {
		case "text": {
			const { width, height } = layoutText(layer);
			return { halfWidth: width / 2, halfHeight: height / 2 };
		}
		case "image":
			return { halfWidth: layer.width / 2, halfHeight: layer.height / 2 };
		case "drawing":
			return drawingBox(layer);
		case "redaction":
			return layer.shape === "strokes"
				? drawingBox(layer)
				: { halfWidth: layer.width / 2, halfHeight: layer.height / 2 };
		case "shape":
			return shapeBox(layer);
	}
}

/** Where a layer's box comes from, in words, for the inspector. */
export function boxSource(layer: Layer): string {
	switch (layer.type) {
		case "text":
			return "laying out its text at its font size, wrapped at maxWidth (approximated here)";
		case "image":
			return "its width and height, in pixels";
		case "drawing":
			return "drawingBox(layer), around what its pens drew";
		case "redaction":
			return layer.shape === "strokes"
				? "drawingBox(layer), around its strokes"
				: "its width and height";
		case "shape":
			return isLine(layer)
				? "shapeBox(layer): its length, and how far the line reaches"
				: "shapeBox(layer): its width and height";
	}
}

function strokePath(points: number[]): string {
	if (points.length < 2) return "";
	const [x, y, ...rest] = points;
	let path = `M${x},${y}`;
	for (let i = 0; i < rest.length; i += 2)
		path += ` L${rest[i]},${rest[i + 1]}`;
	// A dot is a line from its point to itself.
	return rest.length === 0 ? `${path} L${x},${y}` : path;
}

function StrokeView({ stroke }: { stroke: Stroke }) {
	if (stroke.type !== "pen") return null;
	return (
		<path
			d={strokePath(stroke.points)}
			fill="none"
			stroke={stroke.color}
			strokeWidth={stroke.width}
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	);
}

function TextView({ layer }: { layer: TextLayer }) {
	const { lines, width, height } = layoutText(layer);
	const lineHeight = layer.fontSize * LINE_HEIGHT;
	const x =
		layer.align === "left"
			? -width / 2
			: layer.align === "right"
				? width / 2
				: 0;
	const anchor =
		layer.align === "left"
			? "start"
			: layer.align === "right"
				? "end"
				: "middle";
	const text = (outline: boolean) => (
		<text
			x={x}
			textAnchor={anchor}
			fontFamily="Anton, sans-serif"
			fontSize={layer.fontSize}
			fill={outline ? "none" : layer.color}
			stroke={outline ? (layer.outlineColor ?? undefined) : undefined}
			strokeWidth={outline ? layer.fontSize * 0.16 : undefined}
			strokeLinejoin="round"
		>
			{lines.map((line, index) => (
				<tspan
					// biome-ignore lint/suspicious/noArrayIndexKey: lines are positional.
					key={index}
					x={x}
					y={-height / 2 + (index + 0.5) * lineHeight}
					dominantBaseline="central"
				>
					{line}
				</tspan>
			))}
		</text>
	);
	return (
		<g>
			{layer.outlineColor !== null && text(true)}
			{text(false)}
		</g>
	);
}

function ShapeView({ layer }: { layer: ShapeLayer }) {
	const { color, strokeWidth } = layer;
	const box = shapeBox(layer);
	if (isLine(layer)) {
		const half = box.halfWidth;
		const reach = strokeWidth / 2;
		let end = half;
		let head = null;
		if (layer.shape === "arrow") {
			const { length, halfWidth } = arrowHead(strokeWidth, layer.length);
			const base = half - length;
			head = (
				<polygon
					points={`${half},0 ${base},${halfWidth} ${base},${-halfWidth}`}
					fill={color}
				/>
			);
			end = base + length / 2;
		}
		return (
			<g>
				<rect
					x={-half}
					y={-reach}
					width={Math.max(end + half, strokeWidth)}
					height={reach * 2}
					rx={reach}
					fill={color}
				/>
				{head}
			</g>
		);
	}
	// A ring whose outer edge is the box's.
	const thickness = outlineThickness(box, strokeWidth);
	const a = box.halfWidth - thickness / 2;
	const b = box.halfHeight - thickness / 2;
	return layer.shape === "rectangle" ? (
		<rect
			x={-a}
			y={-b}
			width={a * 2}
			height={b * 2}
			fill="none"
			stroke={color}
			strokeWidth={thickness}
		/>
	) : (
		<ellipse rx={a} ry={b} fill="none" stroke={color} strokeWidth={thickness} />
	);
}

function Sticker({ width, height }: { width: number; height: number }) {
	const r = Math.min(width, height) / 2;
	const points = Array.from({ length: 10 }, (_, i) => {
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;
		const reach = i % 2 === 0 ? r * 0.95 : r * 0.42;
		return `${reach * Math.cos(angle)},${reach * Math.sin(angle)}`;
	}).join(" ");
	return (
		<polygon
			points={points}
			fill="#FF7A45"
			stroke="#FFFFFF"
			strokeWidth={r * 0.08}
			strokeLinejoin="round"
		/>
	);
}

/**
 * An image, colored by its adjustments through the model's own color matrix.
 * SVG's `feColorMatrix` takes Skia's layout: rows of R, G, B, A, with offsets
 * from 0 to 1 in the last column.
 */
function ImageView({ layer }: { layer: ImageLayer }) {
	const filter = useId();
	const { adjustments } = layer;
	return (
		<g
			transform={layer.flipped ? "scale(-1 1)" : undefined}
			filter={adjustments ? `url(#${filter})` : undefined}
		>
			{adjustments && (
				<defs>
					<filter id={filter} colorInterpolationFilters="sRGB">
						<feColorMatrix
							type="matrix"
							values={adjustmentMatrix(adjustments).join(" ")}
						/>
					</filter>
				</defs>
			)}
			{layer.sticker ? (
				<Sticker width={layer.width} height={layer.height} />
			) : (
				<Photo
					width={layer.width}
					height={layer.height}
					palette={layer.id === "photo" ? "day" : "dusk"}
				/>
			)}
		</g>
	);
}

/** A layer's content in its own space. Redactions draw in `PlacedLayer`. */
export function LayerContent({ layer }: { layer: Layer }) {
	switch (layer.type) {
		case "image":
			return <ImageView layer={layer} />;
		case "text":
			return <TextView layer={layer} />;
		case "drawing":
			return (
				<g>
					{layer.strokes.map((stroke, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: strokes only append.
						<StrokeView key={index} stroke={stroke} />
					))}
				</g>
			);
		case "shape":
			return <ShapeView layer={layer} />;
		case "redaction":
			return null;
	}
}

/**
 * Draws a layer where its transform puts it. `below` is everything under it,
 * which a blur redaction blurs, as the app's backdrop filter does.
 */
export function PlacedLayer({
	layer,
	below,
}: {
	layer: Layer;
	below: ReactNode;
}) {
	if (layer.hidden) return null;
	if (layer.type === "redaction" && layer.shape === "box") {
		return <RedactionBoxView layer={layer} below={below} />;
	}
	return (
		<g transform={svgMatrix(layer.transform)}>
			<LayerContent layer={layer} />
		</g>
	);
}

function RedactionBoxView({
	layer,
	below,
}: {
	layer: Extract<Layer, { type: "redaction"; shape: "box" }>;
	below: ReactNode;
}) {
	const clip = `clip-${layer.id}`;
	const blur = `blur-${layer.id}`;
	const box = (
		<rect
			x={-layer.width / 2}
			y={-layer.height / 2}
			width={layer.width}
			height={layer.height}
			transform={svgMatrix(layer.transform)}
		/>
	);
	const { effect } = layer;
	if (effect.type === "solid") {
		return <g fill={effect.color}>{box}</g>;
	}
	return (
		<g>
			<defs>
				<clipPath id={clip}>{box}</clipPath>
				<filter
					id={blur}
					filterUnits="userSpaceOnUse"
					x={-2000}
					y={-2000}
					width={6000}
					height={6000}
				>
					<feGaussianBlur
						stdDeviation={effect.type === "blur" ? effect.radius : 0}
					/>
				</filter>
			</defs>
			<g clipPath={`url(#${clip})`}>
				<g filter={effect.type === "blur" ? `url(#${blur})` : undefined}>
					{below}
				</g>
			</g>
		</g>
	);
}

/**
 * A document's canvas and layers, bottom to top. Each layer is drawn over
 * everything below it, which a blur redaction needs to blur.
 */
export function DocumentScene({ document }: { document: EditorDocument }) {
	const { width, height } = document;
	let scene: ReactNode = (
		<rect
			width={width}
			height={height}
			fill={document.background ?? "url(#checker)"}
		/>
	);
	for (const layer of document.layers) {
		scene = (
			<>
				{scene}
				<PlacedLayer layer={layer} below={scene} />
			</>
		);
	}
	return (
		<>
			<defs>
				<pattern
					id="checker"
					width={48}
					height={48}
					patternUnits="userSpaceOnUse"
				>
					<rect width={48} height={48} fill="#EDEEF0" />
					<rect width={24} height={24} fill="#D3D5D9" />
					<rect x={24} y={24} width={24} height={24} fill="#D3D5D9" />
				</pattern>
				<clipPath id="document-canvas">
					<rect width={width} height={height} />
				</clipPath>
			</defs>
			<rect className="canvas" width={width} height={height} />
			<g clipPath="url(#document-canvas)">{scene}</g>
		</>
	);
}

/**
 * The selection outline around a layer's own box, turned and scaled with
 * it, and its handles at the corners, sized for the screen rather than the
 * layer. A locked layer can't be moved on the canvas, so its outline is
 * dashed and it has no handles.
 */
export function Selection({ layer }: { layer: Layer }) {
	const box = layerBox(layer);
	const corners = [
		{ x: -box.halfWidth, y: -box.halfHeight },
		{ x: box.halfWidth, y: -box.halfHeight },
		{ x: box.halfWidth, y: box.halfHeight },
		{ x: -box.halfWidth, y: box.halfHeight },
	].map((corner) => toDocumentSpace(layer.transform, corner));
	return (
		<g className={layer.locked ? "selection locked" : "selection"}>
			<polygon
				points={corners.map(({ x, y }) => `${x},${y}`).join(" ")}
				className="selection-outline"
			/>
			{!layer.locked &&
				corners.map(({ x, y }) => (
					<rect
						key={`${x},${y}`}
						x={x - 9}
						y={y - 9}
						width={18}
						height={18}
						rx={3}
						className="selection-handle"
					/>
				))}
			<circle
				cx={layer.transform.x}
				cy={layer.transform.y}
				r={7}
				className="selection-origin"
			/>
		</g>
	);
}
