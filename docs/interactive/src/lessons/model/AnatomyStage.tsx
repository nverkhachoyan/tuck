import type { EditorDocument } from "@model/document.ts";
import { hitTestBox, type Point } from "@model/geometry.ts";
import type { Layer } from "@model/layers/layer.ts";
import { type PointerEvent, useRef } from "react";
import { DocumentScene, layerBox, Selection } from "./layerViews.tsx";

const MARGIN = 40;

/**
 * Which layer a tap at `point` lands on: the topmost one that's visible and
 * unlocked and whose box holds the point, as the editor's hit test asks.
 */
export function layerAt(
	document: EditorDocument,
	point: Point,
): Layer | undefined {
	return document.layers.findLast(
		(layer) =>
			!layer.hidden &&
			!layer.locked &&
			hitTestBox(layer.transform, layerBox(layer), point),
	);
}

/**
 * A document drawn bottom to top in SVG. Pressing a layer selects it and
 * drags it; pressing anywhere else clears the selection.
 */
export function AnatomyStage({
	document,
	selected,
	onSelect,
	onMove,
}: {
	document: EditorDocument;
	selected: Layer | undefined;
	onSelect: (id: string | null) => void;
	onMove: (id: string, center: Point) => void;
}) {
	const svg = useRef<SVGSVGElement>(null);
	const drag = useRef<{ id: string; offset: Point } | null>(null);
	const { width, height } = document;

	const toDocument = (event: PointerEvent): Point => {
		const matrix = svg.current?.getScreenCTM()?.inverse();
		if (!matrix) return { x: 0, y: 0 };
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
			matrix,
		);
		return { x: point.x, y: point.y };
	};

	const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
		const point = toDocument(event);
		const layer = layerAt(document, point);
		onSelect(layer?.id ?? null);
		if (!layer) return;
		drag.current = {
			id: layer.id,
			offset: {
				x: layer.transform.x - point.x,
				y: layer.transform.y - point.y,
			},
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
		const current = drag.current;
		if (!current) return;
		const point = toDocument(event);
		onMove(current.id, {
			x: Math.round(point.x + current.offset.x),
			y: Math.round(point.y + current.offset.y),
		});
	};

	return (
		<svg
			ref={svg}
			className="stage anatomy-stage"
			viewBox={`${-MARGIN} ${-MARGIN} ${width + MARGIN * 2} ${height + MARGIN * 2}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={() => {
				drag.current = null;
			}}
			role="img"
			aria-label="The document, its layers drawn bottom to top"
		>
			<DocumentScene document={document} />
			{selected && !selected.hidden && <Selection layer={selected} />}
		</svg>
	);
}
