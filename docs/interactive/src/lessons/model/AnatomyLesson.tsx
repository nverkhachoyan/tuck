import {
	createDocumentFromImage,
	type EditorDocument,
	hasEdits,
	hasTransparency,
} from "@model/document.ts";
import type { Transform } from "@model/geometry.ts";
import { createDrawingLayer } from "@model/layers/drawing.ts";
import { createImageLayer, createStickerLayer } from "@model/layers/image.ts";
import {
	duplicateLayer,
	type Layer,
	reorderLayer,
} from "@model/layers/layer.ts";
import { createRedactionBox } from "@model/layers/redaction.ts";
import {
	createShapeLayer,
	isLine,
	isLineShape,
	type ShapeKind,
} from "@model/layers/shape.ts";
import { createTextLayer } from "@model/layers/text.ts";
import { useEffect, useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { antonLoaded } from "../../ui/fonts.ts";
import { format } from "../../ui/format.ts";
import { AnatomyStage } from "./AnatomyStage.tsx";
import { boxSource, layerBox } from "./layerViews.tsx";

type Anatomy = {
	document: EditorDocument;
	selectedId: string | null;
	// The nudge the last duplicate got, and from what kind of layer.
	duplicated: { offset: number; label: string } | null;
	reordered: boolean;
};

const START: Anatomy = {
	document: createDocumentFromImage("photo.jpg", 1200, 900, true),
	selectedId: null,
	duplicated: null,
	reordered: false,
};

const captions = ["Golden hour", "Out of office", "Weekend mode"];
const shapeKinds: ShapeKind[] = ["rectangle", "ellipse", "arrow", "line"];

function squiggle(): number[] {
	const points: number[] = [];
	for (let i = 0; i <= 40; i += 1) {
		points.push(160 + i * 10, Math.round(700 + 55 * Math.sin(i / 4)));
	}
	return points;
}

function layerLabel(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return layer.id === "photo"
				? "The photo"
				: layer.sticker
					? "Sticker"
					: "Image";
		case "text":
			return `“${layer.text}”`;
		case "drawing":
			return "Drawing";
		case "redaction":
			return `Redaction · ${layer.effect.type}`;
		case "shape":
			return `Shape · ${layer.shape}`;
	}
}

type Declaration = { file: SourceFile; name: string };

// The declaration that defines a layer, and the factory that made it.
function declarations(layer: Layer): {
	type: Declaration;
	factory: Declaration;
} {
	const file = `src/model/layers/${layer.type}.ts` as const;
	switch (layer.type) {
		case "image":
			return {
				type: { file, name: "ImageLayer" },
				factory:
					layer.id === "photo"
						? { file: "src/model/document.ts", name: "createDocumentFromImage" }
						: {
								file,
								name: layer.sticker ? "createStickerLayer" : "createImageLayer",
							},
			};
		case "text":
			return {
				type: { file, name: "TextLayer" },
				factory: { file, name: "createTextLayer" },
			};
		case "drawing":
			return {
				type: { file, name: "DrawingLayer" },
				factory: { file, name: "createDrawingLayer" },
			};
		case "redaction": {
			const [type, factory] =
				layer.shape === "box"
					? ["RedactionBox", "createRedactionBox"]
					: layer.shape === "strokes"
						? ["RedactionStrokes", "createRedactionStrokes"]
						: ["RedactionMask", "createMaskedRedaction"];
			return { type: { file, name: type }, factory: { file, name: factory } };
		}
		case "shape":
			return {
				type: { file, name: isLine(layer) ? "LineShape" : "BoxShape" },
				factory: { file, name: "createShapeLayer" },
			};
	}
}

// Every layer has these, from `LayerBase`.
const baseKeys = new Set(["id", "transform", "hidden", "locked", "resizable"]);
// The tags TypeScript narrows the `Layer` union on.
const tagKeys = new Set(["type", "shape"]);

function jsonValue(value: unknown): string {
	if (typeof value === "string") return `"${value}"`;
	if (typeof value === "number") return format(value);
	if (Array.isArray(value)) {
		const points = value.reduce(
			(sum: number, item) =>
				sum + (Array.isArray(item?.points) ? item.points.length / 2 : 0),
			0,
		);
		const noun = value.length === 1 ? "stroke" : "strokes";
		return points > 0
			? `[${value.length} ${noun}, ${points} points]`
			: `[${value.length} items]`;
	}
	if (value && typeof value === "object") {
		const entries = Object.entries(value).map(
			([key, item]) => `${key}: ${jsonValue(item)}`,
		);
		return `{ ${entries.join(", ")} }`;
	}
	return String(value);
}

/** A layer as the plain object it is, keys marked by where they come from. */
function LayerJson({ layer }: { layer: Layer }) {
	return (
		<pre className="layer-json">
			{"{\n"}
			{Object.entries(layer).map(([key, value]) => (
				<span
					key={key}
					className={
						tagKeys.has(key)
							? "json-tag"
							: baseKeys.has(key)
								? "json-base"
								: "json-own"
					}
				>
					{"  "}
					<span className="json-key">{key}</span>: {jsonValue(value)}
					{",\n"}
				</span>
			))}
			{"}"}
		</pre>
	);
}

const toDegrees = (radians: number) => Math.round((radians * 180) / Math.PI);

export function AnatomyLesson() {
	const [state, setState] = useState<Anatomy>(START);
	const [run, setRun] = useState(0);
	const [tabName, setTabName] = useState<string | null>(null);
	// Text is measured in Anton: lay it out again once the font arrives.
	const [, setFontReady] = useState(false);
	useEffect(() => {
		antonLoaded.then(() => setFontReady(true));
	}, []);

	const { document } = state;
	const selected = document.layers.find(
		(layer) => layer.id === state.selectedId,
	);
	const count = (type: Layer["type"]) =>
		document.layers.filter((layer) => layer.type === type).length;

	const setLayers = (update: (layers: Layer[]) => Layer[]) =>
		setState((previous) => ({
			...previous,
			document: {
				...previous.document,
				layers: update(previous.document.layers),
			},
		}));
	const updateLayer = (id: string, update: (layer: Layer) => Layer) =>
		setLayers((layers) =>
			layers.map((layer) => (layer.id === id ? update(layer) : layer)),
		);
	const setTransform = (id: string, patch: Partial<Transform>) =>
		updateLayer(id, (layer) => ({
			...layer,
			transform: { ...layer.transform, ...patch },
		}));
	const addOnTop = (layer: Layer) =>
		setState((previous) => ({
			...previous,
			selectedId: layer.id,
			document: {
				...previous.document,
				layers: [...previous.document.layers, layer],
			},
		}));

	const nextShape = shapeKinds[count("shape") % shapeKinds.length];
	const adders: { label: string; add: () => Layer }[] = [
		{
			label: "Text",
			add: () =>
				createTextLayer(document, captions[count("text") % captions.length]),
		},
		{
			label: nextShape[0].toUpperCase() + nextShape.slice(1),
			add: () => {
				const n = count("shape");
				const line = isLineShape(nextShape);
				return createShapeLayer(
					nextShape,
					{
						x: 840 + n * 40,
						y: 330 + n * 40,
						rotation: line ? -0.4 : 0,
						width: line ? 380 : 320,
						height: 200,
					},
					{ color: "#FF3B30", strokeWidth: 14 },
				);
			},
		},
		{
			label: "Drawing",
			add: () =>
				createDrawingLayer({
					type: "pen",
					color: "#FF2D95",
					width: 16,
					points: squiggle(),
				}),
		},
		{
			label: "Redaction",
			add: () => {
				const n = count("redaction");
				return createRedactionBox(
					// Over the sun, where there's something to blur.
					{ x: 100 + n * 40, y: 120 + n * 40, width: 300, height: 170 },
					{ type: "blur", radius: 22 },
				);
			},
		},
		{
			label: "Image",
			add: () => createImageLayer(document, "added.jpg", 1600, 1000, true),
		},
		{
			label: "Sticker",
			add: () => createStickerLayer(document, "sticker.png", 512, 512, false),
		},
	];

	const move = (id: string, offset: number) => {
		const from = document.layers.findIndex((layer) => layer.id === id);
		const layers = reorderLayer(document.layers, id, from + offset);
		if (layers === document.layers) return;
		setState((previous) => ({
			...previous,
			reordered: true,
			document: { ...previous.document, layers },
		}));
	};

	const duplicate = (layer: Layer) => {
		const copy = duplicateLayer(layer);
		addOnTop(copy);
		setState((previous) => ({
			...previous,
			duplicated: {
				offset: copy.transform.x - layer.transform.x,
				label: layerLabel(layer),
			},
		}));
	};

	const remove = (id: string) =>
		setState((previous) => ({
			...previous,
			selectedId: null,
			document: {
				...previous.document,
				layers: previous.document.layers.filter((layer) => layer.id !== id),
			},
		}));

	const isPhoto = (layer: Layer) => layer.id === "photo";
	const steps: FlowStep<Anatomy>[] = [
		{
			title: "Meet the photo",
			body: (
				<p>
					Choose <strong>The photo</strong> in the layers list. It's an ordinary
					image layer: <code>createDocumentFromImage</code> makes a canvas its
					size, centers it with <code>centeredTransform</code>, and locks it, so
					taps on the canvas pass it by (try one). And <code>hasEdits</code> is
					false: an untouched photo isn't worth saving as a project.
				</p>
			),
			done: (s) => s.selectedId === "photo",
		},
		{
			title: "Add a caption",
			body: (
				<p>
					Add a text layer. <code>createTextLayer</code> centers it on the
					canvas and sizes it to the canvas, not the screen: a font size of 8%
					of the shorter side (72 here), wrapping at 90% of the width. Its JSON
					has no width or height: its box comes from laying out the text.
				</p>
			),
			done: (s) => s.document.layers.some((layer) => layer.type === "text"),
		},
		{
			title: "Add a shape and a redaction",
			body: (
				<p>
					Each keeps its box differently: a rectangle its <code>width</code> and{" "}
					<code>height</code>, a line its <code>length</code>, a redaction its
					own <code>width</code> and <code>height</code>. Compare their JSON:
					the shared keys are gray, the tags bold.
				</p>
			),
			done: (s) =>
				s.document.layers.some((layer) => layer.type === "shape") &&
				s.document.layers.some((layer) => layer.type === "redaction"),
		},
		{
			title: "Turn something",
			body: (
				<p>
					Select any layer you added and turn it. The selection turns with it,
					because the editor draws it around the layer's box in the layer's own
					space. That box is the one question the editor asks a layer, in{" "}
					<code>layerBounds</code>; the outline, the handles, and hit testing
					all follow from the answer.
				</p>
			),
			done: (s) =>
				s.document.layers.some(
					(layer) => !isPhoto(layer) && layer.transform.rotation !== 0,
				),
		},
		{
			title: "Duplicate a layer",
			body: (
				<p>
					Duplicate one, then another of a different type, and watch how far
					each copy moves. <code>duplicateLayer</code> nudges by{" "}
					<code>duplicateOffset</code>, a <code>switch</code> over the layer
					types with no <code>default</code>: add a type and it won't compile
					until it gets a case.
				</p>
			),
			done: (s) => s.duplicated !== null,
		},
		{
			title: "Change the stacking",
			body: (
				<p>
					Move a layer up or down. <code>layers</code> runs bottom to top, and{" "}
					<code>reorderLayer</code> returns the very same array when nothing
					would change, so the store can tell an edit from a no-op with{" "}
					<code>===</code>.
				</p>
			),
			done: (s) => s.reordered,
		},
		{
			title: "Hide the photo",
			body: (
				<p>
					Hide the photo and the canvas turns to a checkerboard.{" "}
					<code>hasTransparency</code> asks whether a visible, opaque image
					covers all four corners of the canvas, with <code>hitTestBox</code>{" "}
					from the last lesson. Now none does, so the export would be a PNG.
				</p>
			),
			done: (s) => hasTransparency(s.document),
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		...(selected
			? Object.values(declarations(selected)).map((declaration) => ({
					label: declaration.name,
					...declaration,
				}))
			: []),
		{ label: "Layer", file: "src/model/layers/layer.ts", name: "Layer" },
		{
			label: "EditorDocument",
			file: "src/model/document.ts",
			name: "EditorDocument",
		},
		{
			label: "layerBounds",
			file: "src/editor/canvas/layerBounds.ts",
			name: "layerBounds",
		},
		{
			label: "duplicateOffset",
			file: "src/model/layers/layer.ts",
			name: "duplicateOffset",
		},
		{
			label: "hasTransparency",
			file: "src/model/document.ts",
			name: "hasTransparency",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	const box = selected ? layerBox(selected) : null;
	const topFirst = [...document.layers].reverse();

	return (
		<article className="lesson">
			<p className="eyebrow">The model · Lesson 2</p>
			<h1>Anatomy of a layer</h1>
			<p className="lede">
				A document is a canvas and a flat list of layers, bottom to top. Every
				layer, whatever it draws, has the same anatomy: the fields every layer
				shares, a <code>type</code> tag, and content centered on its own origin,
				placed by its <code>transform</code>. Everything below is built with the
				model's real factories.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<AnatomyStage
							document={document}
							selected={selected}
							onSelect={(id) =>
								setState((previous) => ({ ...previous, selectedId: id }))
							}
							onMove={(id, center) => setTransform(id, center)}
						/>
						<figcaption>
							<strong>The document.</strong> Press a layer to select it, and
							drag to move it. A tap finds the topmost visible, unlocked layer
							whose box holds the point, the way the editor does.
						</figcaption>
					</figure>

					<div className="pair">
						<section className="panel layers-panel" aria-label="Layers">
							<h2>Layers</h2>
							<div className="adders">
								{adders.map((adder) => (
									<button
										key={adder.label}
										type="button"
										className="button-small"
										onClick={() => addOnTop(adder.add())}
									>
										+ {adder.label}
									</button>
								))}
							</div>
							<p className="list-note">Top of the stack first.</p>
							<ol className="layer-list">
								{topFirst.map((layer) => {
									const index = document.layers.indexOf(layer);
									const chosen = layer.id === state.selectedId;
									return (
										<li
											key={layer.id}
											className={chosen ? "chosen" : undefined}
										>
											<button
												type="button"
												className="layer-name"
												aria-pressed={chosen}
												onClick={() =>
													setState((previous) => ({
														...previous,
														selectedId: layer.id,
													}))
												}
											>
												<span className={layer.hidden ? "faded" : undefined}>
													{layerLabel(layer)}
												</span>
												<small>
													{index} · {layer.type}
												</small>
											</button>
											<button
												type="button"
												className="icon-button"
												onClick={() =>
													updateLayer(layer.id, (l) => ({
														...l,
														hidden: !l.hidden,
													}))
												}
											>
												{layer.hidden ? "Show" : "Hide"}
											</button>
											<button
												type="button"
												className="icon-button"
												onClick={() =>
													updateLayer(layer.id, (l) => ({
														...l,
														locked: !l.locked,
													}))
												}
											>
												{layer.locked ? "Unlock" : "Lock"}
											</button>
											<button
												type="button"
												className="icon-button"
												aria-label="Move up"
												disabled={index === document.layers.length - 1}
												onClick={() => move(layer.id, 1)}
											>
												↑
											</button>
											<button
												type="button"
												className="icon-button"
												aria-label="Move down"
												disabled={index === 0}
												onClick={() => move(layer.id, -1)}
											>
												↓
											</button>
										</li>
									);
								})}
								{topFirst.length === 0 && (
									<li className="empty">
										No layers: a document can be just a canvas.
									</li>
								)}
							</ol>
						</section>

						<section className="panel inspector" aria-label="Selected layer">
							{selected && box ? (
								<>
									<h2>{layerLabel(selected)}</h2>
									<LayerJson layer={selected} />
									<p className="json-legend">
										<span className="json-base">shared by every layer</span>
										<span className="json-tag">the tag it narrows on</span>
										<span className="json-own">its own</span>
									</p>
									<p className="box-readout">
										<strong>Its box:</strong> {format(box.halfWidth * 2)} ×{" "}
										{format(box.halfHeight * 2)}, centered on its origin, from{" "}
										{boxSource(selected)}.
									</p>
									{selected.type === "text" && (
										<label className="text-input">
											<span>text</span>
											<input
												value={selected.text}
												onChange={(event) =>
													updateLayer(selected.id, (layer) => ({
														...layer,
														text: event.target.value,
													}))
												}
											/>
										</label>
									)}
									<label className="slider">
										<span className="slider-label">rotation</span>
										<input
											type="range"
											min={-180}
											max={180}
											step={1}
											value={toDegrees(selected.transform.rotation)}
											onChange={(event) =>
												setTransform(selected.id, {
													rotation:
														(Number(event.target.value) * Math.PI) / 180,
												})
											}
										/>
										<output>{toDegrees(selected.transform.rotation)}°</output>
									</label>
									<label className="slider">
										<span className="slider-label">scale</span>
										<input
											type="range"
											min={0.2}
											max={3}
											step={0.05}
											value={selected.transform.scaleX}
											onChange={(event) => {
												const scale = Number(event.target.value);
												setTransform(selected.id, {
													scaleX: scale,
													scaleY: scale,
												});
											}}
										/>
										<output>{format(selected.transform.scaleX)}</output>
									</label>
									<div className="presets">
										<button
											type="button"
											className="button-small"
											onClick={() => duplicate(selected)}
										>
											Duplicate
										</button>
										<button
											type="button"
											className="button-small"
											onClick={() => remove(selected.id)}
										>
											Delete
										</button>
									</div>
									{state.duplicated && (
										<p className="hint">
											The last copy of {state.duplicated.label.toLowerCase()}{" "}
											moved {format(state.duplicated.offset)} down and right.
										</p>
									)}
								</>
							) : (
								<p className="hint">
									Select a layer, on the canvas or in the list, to see what it's
									made of.
								</p>
							)}
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={state} />
					</section>
					<section className="panel document-panel" aria-label="The document">
						<h2>
							<code>document</code>
						</h2>
						<dl>
							<dt>width × height</dt>
							<dd>
								{document.width} × {document.height}
							</dd>
							<dt>background</dt>
							<dd>{document.background ?? "null (transparent)"}</dd>
							<dt>layers</dt>
							<dd>{document.layers.length}</dd>
							<dt>
								<code>hasEdits</code>
							</dt>
							<dd>{String(hasEdits(document))}</dd>
							<dt>
								<code>hasTransparency</code>
							</dt>
							<dd>
								{String(hasTransparency(document))}
								<small>
									{hasTransparency(document)
										? "exports as PNG"
										: "exports as JPEG"}
								</small>
							</dd>
						</dl>
						<div className="presets">
							<button
								type="button"
								className="button-small"
								onClick={() => {
									setState(START);
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
					The declarations behind what you just built, read from the source as
					it is now. The first tabs follow the selected layer.
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
						<h3>One question per layer</h3>
						<p>
							Because every layer's content is centered on its own origin, the
							editor only needs one thing from each type: its box. The selection
							outline, the handles, and hit testing work the same for all of
							them.
						</p>
					</div>
					<div className="card">
						<h3>The compiler keeps the switches honest</h3>
						<p>
							<code>Layer</code> is a union tagged on <code>type</code> (and
							redactions and shapes again on <code>shape</code>). Switches over
							it have no fallback, so a new layer type fails to compile until
							every switch handles it.
						</p>
					</div>
					<div className="card">
						<h3>Sizes follow the canvas</h3>
						<p>
							New text is 8% of the shorter side, a sticker 30%, and an image
							shrinks to fit 80% but is never enlarged past its pixels. A
							caption looks the same on a screenshot and on a camera photo.
						</p>
					</div>
					<div className="card">
						<h3>Groups are only lists of ids</h3>
						<p>
							A <code>LayerGroup</code> names some layers without nesting them,
							so <code>layers</code> stays one flat paint order. Drawing,
							export, and hit testing never need to know groups exist.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
