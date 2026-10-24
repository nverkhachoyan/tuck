import {
	createDocumentFromImage,
	createDrawingLayer,
	type DrawingLayer,
	type EditorDocument,
	type Stroke,
} from "@model/document.ts";
import { addStroke, drawingBox, hitTestDrawing } from "@model/drawing.ts";
import {
	hitTestBox,
	type Point,
	type Transform,
	toLayerSpace,
} from "@model/geometry.ts";
import { useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { format } from "../../ui/format.ts";
import {
	StoredStrokesView,
	type StrokeMode,
	StrokesStage,
} from "./StrokesStage.tsx";

const PHOTO = createDocumentFromImage("photo.jpg", 1200, 900, true);
// How near the ink a tap must land, in the layer's own units, like the
// editor's hit padding.
const HIT_PADDING = 12;

type LastStroke = {
	drawn: Stroke;
	stored: Stroke;
	// The origin before and after `recenterDrawing`, in document space.
	from: Point;
	to: Point;
	scale: number;
};

type StrokesState = {
	layer: DrawingLayer | null;
	last: LastStroke | null;
	turned: boolean;
	drewTransformed: boolean;
	erased: boolean;
	probe: { point: Point; inBox: boolean; nearInk: boolean } | null;
	probedLoop: boolean;
};

const START: StrokesState = {
	layer: null,
	last: null,
	turned: false,
	drewTransformed: false,
	erased: false,
	probe: null,
	probedLoop: false,
};

const colors = ["#FF2D95", "#2F6BFF", "#111111"];

function point(stroke: Stroke): string {
	return `${format(stroke.points[0])}, ${format(stroke.points[1])}`;
}

export function StrokesLesson() {
	const [state, setState] = useState<StrokesState>(START);
	const [run, setRun] = useState(0);
	const [mode, setMode] = useState<StrokeMode>("pen");
	const [color, setColor] = useState(colors[0]);
	const [width, setWidth] = useState(18);
	const [tabName, setTabName] = useState("addStroke");

	const { layer, last, probe } = state;
	const document: EditorDocument = layer
		? { ...PHOTO, layers: [...PHOTO.layers, layer] }
		: PHOTO;

	const onStroke = (points: number[]) => {
		const drawn: Stroke =
			mode === "eraser"
				? { type: "eraser", width, points }
				: { type: "pen", color, width, points };
		setState((current) => {
			const before = current.layer;
			// An eraser can't start a drawing: there's nothing to erase yet.
			if (!before && drawn.type !== "pen") return current;
			const after = before
				? addStroke(before, drawn)
				: createDrawingLayer(drawn as Stroke & { type: "pen" });
			const from = before
				? { x: before.transform.x, y: before.transform.y }
				: { x: 0, y: 0 };
			const transformed =
				before !== null &&
				(before.transform.rotation !== 0 || before.transform.scaleX !== 1);
			return {
				...current,
				layer: after,
				last: {
					drawn,
					stored: after.strokes[after.strokes.length - 1],
					from,
					to: { x: after.transform.x, y: after.transform.y },
					scale: before?.transform.scaleX ?? 1,
				},
				drewTransformed: current.drewTransformed || transformed,
				erased: current.erased || drawn.type === "eraser",
				probe: null,
			};
		});
	};

	const onProbe = (at: Point) =>
		setState((current) => {
			if (!current.layer) return current;
			const { transform } = current.layer;
			const box = drawingBox(current.layer);
			const padded = {
				halfWidth: box.halfWidth + HIT_PADDING,
				halfHeight: box.halfHeight + HIT_PADDING,
			};
			const inBox = hitTestBox(transform, padded, at);
			const nearInk =
				inBox &&
				hitTestDrawing(current.layer, toLayerSpace(transform, at), HIT_PADDING);
			return {
				...current,
				probe: { point: at, inBox, nearInk },
				probedLoop: current.probedLoop || (inBox && !nearInk),
			};
		});

	const setTransform = (patch: Partial<Transform>) =>
		setState((current) =>
			current.layer
				? {
						...current,
						layer: {
							...current.layer,
							transform: { ...current.layer.transform, ...patch },
						},
						last: null,
						probe: null,
						turned: true,
					}
				: current,
		);

	const steps: FlowStep<StrokesState>[] = [
		{
			title: "Draw a stroke",
			body: (
				<p>
					Draw anywhere. With no drawing selected, <code>drawStroke</code> calls{" "}
					<code>createDrawingLayer</code>. Its transform starts at the canvas's
					top-left corner, then <code>recenterDrawing</code> moves the origin to
					the middle of the ink and shifts every point to match: see the dashed
					arrow. Turning and handles then go around what you drew.
				</p>
			),
			done: (s) => s.layer !== null,
		},
		{
			title: "Turn and grow it",
			body: (
				<p>
					Turn and scale the drawing with the sliders. Only its{" "}
					<code>transform</code> changes. Its strokes stay as they're stored,
					which the smaller view shows: in its own space, unturned.
				</p>
			),
			done: (s) => s.turned,
		},
		{
			title: "Draw over it again",
			body: (
				<p>
					Draw another stroke while it's turned. <code>addStroke</code> runs
					each point through <code>toLayerSpace</code> and divides the width by
					the scale, so the stored numbers differ from what you drew, yet the
					ink lands right under your pointer. Compare the two rows in{" "}
					<strong>The last stroke</strong>.
				</p>
			),
			done: (s) => s.drewTransformed,
		},
		{
			title: "Erase across it",
			body: (
				<p>
					Switch to the eraser and erase through the ink. An eraser is stored as
					a stroke too, so it moves with the drawing and can be undone. And{" "}
					<code>drawingBox</code> only counts pens, so erasing never shrinks the
					box.
				</p>
			),
			done: (s) => s.erased,
		},
		{
			title: "Tap inside a loop",
			body: (
				<p>
					Draw a loop, switch to <strong>Probe</strong>, and press its middle.
					The point is inside the drawing's box, but not near its ink. The
					editor's <code>findLayerAt</code> asks both, so a tap inside a circle
					drawn around something reaches what's under it.
				</p>
			),
			done: (s) => s.probedLoop,
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{ label: "addStroke", file: "src/model/drawing.ts", name: "addStroke" },
		{
			label: "recenterDrawing",
			file: "src/model/drawing.ts",
			name: "recenterDrawing",
		},
		{
			label: "createDrawingLayer",
			file: "src/model/document.ts",
			name: "createDrawingLayer",
		},
		{ label: "drawingBox", file: "src/model/drawing.ts", name: "drawingBox" },
		{
			label: "hitTestDrawing",
			file: "src/model/drawing.ts",
			name: "hitTestDrawing",
		},
		{
			label: "drawStroke",
			file: "src/model/edits/draw.ts",
			name: "drawStroke",
		},
		{
			label: "findLayerAt",
			file: "src/screens/editor/canvas/hitTest.ts",
			name: "findLayerAt",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	const pens = layer?.strokes.filter((stroke) => stroke.type === "pen").length;
	const erasers = layer ? layer.strokes.length - (pens ?? 0) : 0;
	const pointCount = layer?.strokes.reduce(
		(sum, stroke) => sum + stroke.points.length / 2,
		0,
	);
	const box = layer ? drawingBox(layer) : null;
	const toDegrees = (radians: number) => Math.round((radians * 180) / Math.PI);

	return (
		<article className="lesson">
			<p className="eyebrow">The model · Lesson 4</p>
			<h1>Strokes into layer space</h1>
			<p className="lede">
				A stroke is drawn in document space, under your pointer. It's stored in
				the drawing's own space, wherever the drawing has been moved, turned, or
				scaled since. From then on only the layer's transform places it, and the
				strokes never need rewriting.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<StrokesStage
							document={document}
							layer={layer}
							mode={layer ? mode : mode === "probe" ? "pen" : mode}
							brush={{ color, width }}
							origin={last ? { from: last.from, to: last.to } : null}
							probe={
								probe && layer
									? {
											point: probe.point,
											selects: probe.nearInk,
											reach: HIT_PADDING * layer.transform.scaleX,
										}
									: null
							}
							onStroke={onStroke}
							onProbe={onProbe}
						/>
						<figcaption>
							<strong>Document space.</strong> Draw with the pointer. The dashed
							arrow shows where the last stroke moved the drawing's origin; the
							blue box is <code>drawingBox</code>, placed by the drawing's
							transform.
						</figcaption>
					</figure>

					<div className="pair">
						<figure className="panel">
							{layer ? (
								<StoredStrokesView layer={layer} />
							) : (
								<div className="stored-empty">Nothing drawn yet.</div>
							)}
							<figcaption>
								<strong>As stored.</strong> The same strokes in the drawing's
								own space, centered on its origin: the numbers in its{" "}
								<code>strokes</code>.
							</figcaption>
						</figure>

						<section
							className="panel stroke-facts"
							aria-label="The last stroke"
						>
							<h2>The last stroke</h2>
							{last ? (
								<dl>
									<dt>drawn at</dt>
									<dd>
										{point(last.drawn)}
										<small>
											width {format(last.drawn.width)}, document space
										</small>
									</dd>
									<dt>stored as</dt>
									<dd>
										{point(last.stored)}
										<small>
											width {format(last.stored.width)}, layer space
											{last.scale !== 1 && ` (÷ ${format(last.scale)})`}
										</small>
									</dd>
									<dt>origin moved</dt>
									<dd>
										{format(last.to.x - last.from.x)},{" "}
										{format(last.to.y - last.from.y)}
										<small>by recenterDrawing</small>
									</dd>
								</dl>
							) : (
								<p className="hint">
									{layer
										? "Draw again to see a stroke go into layer space."
										: "Draw on the canvas to start a drawing."}
								</p>
							)}
							{layer && box && (
								<p className="stroke-totals">
									{pens} {pens === 1 ? "pen" : "pens"}, {erasers}{" "}
									{erasers === 1 ? "eraser" : "erasers"}, {pointCount} points ·
									box {format(box.halfWidth * 2)} × {format(box.halfHeight * 2)}
								</p>
							)}
							{probe && (
								<div className="probe-facts">
									<p>
										<code>hitTestBox</code>:{" "}
										<strong>{probe.inBox ? "inside" : "outside"}</strong>
									</p>
									<p>
										<code>hitTestDrawing</code>:{" "}
										<strong>
											{probe.inBox
												? probe.nearInk
													? "near the ink"
													: "not near the ink"
												: "not asked"}
										</strong>
									</p>
									<p className="hint">
										{probe.nearInk
											? "A tap here selects the drawing."
											: "A tap here passes through to what's under it."}
									</p>
								</div>
							)}
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={state} />
					</section>
					<section className="panel controls" aria-label="Tools">
						<h2>Tools</h2>
						<div className="choice-row">
							{(["pen", "eraser", "probe"] as const).map((choice) => (
								<button
									key={choice}
									type="button"
									className={mode === choice ? "chip chosen" : "chip"}
									aria-pressed={mode === choice}
									disabled={choice !== "pen" && !layer}
									onClick={() => setMode(choice)}
								>
									{choice[0].toUpperCase() + choice.slice(1)}
								</button>
							))}
						</div>
						<div className="choice-row">
							{colors.map((choice) => (
								<button
									key={choice}
									type="button"
									className={color === choice ? "swatch chosen" : "swatch"}
									style={{ background: choice }}
									aria-label={`Pen color ${choice}`}
									aria-pressed={color === choice}
									onClick={() => {
										setColor(choice);
										setMode("pen");
									}}
								/>
							))}
						</div>
						<label className="slider">
							<span className="slider-label">width</span>
							<input
								type="range"
								min={4}
								max={48}
								step={1}
								value={width}
								onChange={(event) => setWidth(Number(event.target.value))}
							/>
							<output>{width}</output>
						</label>
						<h3 className="controls-heading">
							The drawing's <code>transform</code>
						</h3>
						<label className="slider">
							<span className="slider-label">rotation</span>
							<input
								type="range"
								min={-180}
								max={180}
								step={1}
								disabled={!layer}
								value={layer ? toDegrees(layer.transform.rotation) : 0}
								onChange={(event) =>
									setTransform({
										rotation: (Number(event.target.value) * Math.PI) / 180,
									})
								}
							/>
							<output>
								{layer ? toDegrees(layer.transform.rotation) : 0}°
							</output>
						</label>
						<label className="slider">
							<span className="slider-label">scale</span>
							<input
								type="range"
								min={0.4}
								max={2.5}
								step={0.05}
								disabled={!layer}
								value={layer?.transform.scaleX ?? 1}
								onChange={(event) => {
									const scale = Number(event.target.value);
									setTransform({ scaleX: scale, scaleY: scale });
								}}
							/>
							<output>{format(layer?.transform.scaleX ?? 1)}</output>
						</label>
						<div className="presets">
							<button
								type="button"
								className="button-small"
								onClick={() => {
									setState(START);
									setMode("pen");
									setRun((value) => value + 1);
								}}
							>
								Start over
							</button>
						</div>
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					What the canvas above calls when a stroke ends, and what the editor
					asks when you tap.
				</p>
				<div className="tabs" role="tablist">
					{tabs.map((candidate) => (
						<button
							key={candidate.label}
							type="button"
							role="tab"
							aria-selected={candidate === tab}
							className={candidate === tab ? "tab chosen" : "tab"}
							onClick={() => setTabName(candidate.label)}
						>
							{candidate.label}
						</button>
					))}
				</div>
				<SourceView file={tab.file} name={tab.name} />
			</section>

			<section className="takeaways">
				<h2>Why it's built this way</h2>
				<div className="cards">
					<div className="card">
						<h3>Move the layer, not the points</h3>
						<p>
							Because strokes live in the layer's space, moving, turning, or
							scaling a drawing changes five numbers, however many points it
							has. Undo snapshots stay small for the same reason.
						</p>
					</div>
					<div className="card">
						<h3>Small saved projects</h3>
						<p>
							Points are flat <code>[x, y, x, y, …]</code> arrays, rounded to a
							hundredth of a pixel: finer than that is invisible, and would only
							make the project file bigger.
						</p>
					</div>
					<div className="card">
						<h3>Cutting out works the same way</h3>
						<p>
							Refining a cut-out by hand uses <code>addMaskStroke</code> in{" "}
							<code>cutout.ts</code>: the same trip into the image's own pixels,
							plus one step more, undoing a flip, since a mask belongs to the
							unflipped image.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
