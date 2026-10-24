import {
	type AdjustmentKey,
	type Adjustments,
	adjustmentKeys,
	neutralAdjustments,
} from "@model/adjustments.ts";
import {
	createDocumentFromImage,
	type EditorDocument,
} from "@model/document.ts";
import { type ImageLayer, withAdjustments } from "@model/layers/image.ts";
import {
	type Layer,
	reorderLayer,
	resizeLayerBox,
} from "@model/layers/layer.ts";
import {
	createShapeLayer,
	isLine,
	restyleShape,
	type ShapeEdit,
	type ShapeKind,
	type ShapeLayer,
} from "@model/layers/shape.ts";
import { useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { format } from "../../ui/format.ts";
import { DocumentScene } from "./layerViews.tsx";

const SHAPE = createShapeLayer(
	"rectangle",
	{ x: 840, y: 330, rotation: 0, width: 320, height: 200 },
	{ color: "#FF3B30", strokeWidth: 14 },
);
const PHOTO_ID = "photo";

const startDocument: EditorDocument = (() => {
	const document = createDocumentFromImage("photo.jpg", 1200, 900, true);
	return { ...document, layers: [...document.layers, SHAPE] };
})();

type Entry = {
	id: number;
	action: string;
	detail: string;
	// Whether the model handed back a new object, which the store records.
	recorded: boolean;
	before: Layer | Layer[] | null;
	after: Layer | Layer[] | null;
	// Of the new document's layers, how many are the very objects the old
	// one held.
	shared?: { same: number; total: number };
};

type Store = {
	document: EditorDocument;
	past: EditorDocument[];
	future: EditorDocument[];
	log: Entry[];
	undone: boolean;
};

const START: Store = {
	document: startDocument,
	past: [],
	future: [],
	log: [],
	undone: false,
};

let nextEntry = 0;

function photoOf(document: EditorDocument): ImageLayer {
	const photo = document.layers.find((layer) => layer.id === PHOTO_ID);
	if (photo?.type !== "image") throw new Error("The lesson's photo is gone.");
	return photo;
}

// Found by type, not id: the id changes whenever this module reloads.
function shapeOf(document: EditorDocument): ShapeLayer {
	const shape = document.layers.find((layer) => layer.type === "shape");
	if (!shape) throw new Error("The lesson's shape is gone.");
	return shape;
}

/**
 * What the store does with every edit: ask the model for the next value,
 * and record a step only if it's a new object. The model hands back the
 * same value, or null, when nothing would change.
 */
function attempt(
	store: Store,
	action: string,
	detail: string,
	edit: (document: EditorDocument) => {
		before: Layer | Layer[];
		after: Layer | Layer[] | null;
		document: EditorDocument | null;
	},
): Store {
	const { before, after, document } = edit(store.document);
	const recorded = document !== null && after !== null && after !== before;
	const entry: Entry = {
		id: nextEntry++,
		action,
		detail,
		recorded,
		before,
		after,
	};
	if (!recorded || !document) {
		return { ...store, log: [entry, ...store.log] };
	}
	const old = new Set(store.document.layers);
	entry.shared = {
		same: document.layers.filter((layer) => old.has(layer)).length,
		total: document.layers.length,
	};
	return {
		...store,
		document,
		past: [...store.past, store.document],
		future: [],
		log: [entry, ...store.log],
	};
}

function replace(document: EditorDocument, target: Layer, next: Layer | null) {
	return next === null || next === target
		? null
		: {
				...document,
				layers: document.layers.map((layer) =>
					layer === target ? next : layer,
				),
			};
}

// What changed between two objects, by reference, key by key.
function changes(before: object, after: object): string[] {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	const result: string[] = [];
	for (const key of keys) {
		const was = (before as Record<string, unknown>)[key];
		const is = (after as Record<string, unknown>)[key];
		if (!(key in after)) result.push(`${key} left out`);
		else if (!(key in before)) result.push(`${key} added`);
		else if (was !== is) result.push(`${key} changed`);
	}
	return result;
}

const swatches = ["#FF3B30", "#2F6BFF", "#111111"];
const widths = [6, 14, 28];
const kinds: ShapeKind[] = ["rectangle", "ellipse", "line", "arrow"];

export function IdentityLesson() {
	const [store, setStore] = useState<Store>(START);
	const [run, setRun] = useState(0);
	// The adjustments while a slider is held, committed when it's let go,
	// the way a dial's drag is one edit in the app.
	const [draft, setDraft] = useState<Adjustments | null>(null);
	const [tabName, setTabName] = useState("withAdjustments");

	const { document } = store;
	const photo = photoOf(document);
	const shape = shapeOf(document);
	const adjustments = draft ?? photo.adjustments ?? neutralAdjustments;
	const shown: EditorDocument = draft
		? {
				...document,
				layers: document.layers.map((layer) =>
					layer === photo ? withAdjustments(photo, draft) : layer,
				),
			}
		: document;

	const commitAdjustments = () => {
		if (!draft) return;
		const next = draft;
		setDraft(null);
		setStore((current) =>
			attempt(
				current,
				"setAdjustments",
				adjustmentKeys
					.filter((key) => next[key] !== 0)
					.map((key) => `${key} ${format(next[key])}`)
					.join(", ") || "all at 0",
				(document) => {
					const target = photoOf(document);
					const after = withAdjustments(target, next);
					return {
						before: target,
						after,
						document: replace(document, target, after),
					};
				},
			),
		);
	};

	const restyle = (edit: ShapeEdit, detail: string) =>
		setStore((current) =>
			attempt(current, "setShapeStyle", detail, (document) => {
				const target = shapeOf(document);
				const after = restyleShape(target, edit);
				return {
					before: target,
					after,
					document: replace(document, target, after),
				};
			}),
		);

	const resize = (width: number, height: number) =>
		setStore((current) =>
			attempt(current, "resizeBox", `${width} × ${height}`, (document) => {
				const target = shapeOf(document);
				const after = resizeLayerBox(target, target.transform, width, height);
				return {
					before: target,
					after,
					document: replace(document, target, after),
				};
			}),
		);

	const moveShape = (toIndex: number, detail: string) =>
		setStore((current) =>
			attempt(current, "moveLayer", detail, (document) => {
				const layers = reorderLayer(
					document.layers,
					shapeOf(document).id,
					toIndex,
				);
				return {
					before: document.layers,
					after: layers,
					document: { ...document, layers },
				};
			}),
		);

	const undo = () =>
		setStore((current) => {
			const previous = current.past.at(-1);
			if (!previous) return current;
			return {
				...current,
				document: previous,
				past: current.past.slice(0, -1),
				future: [current.document, ...current.future],
				undone: true,
			};
		});

	const redo = () =>
		setStore((current) => {
			const [next, ...future] = current.future;
			if (!next) return current;
			return {
				...current,
				document: next,
				past: [...current.past, current.document],
				future,
			};
		});

	const last = store.log[0];
	const shapeWidth = isLine(shape) ? shape.length : shape.width;
	// A line has no height; `resizeLayerBox` only needs it to be positive.
	const shapeHeight = isLine(shape) ? 1 : shape.height;

	const steps: FlowStep<Store>[] = [
		{
			title: "Brighten the photo",
			body: (
				<p>
					Drag <strong>brightness</strong> up and let go.{" "}
					<code>setAdjustments</code> calls <code>withAdjustments</code>, gets a
					new layer back, and the store records an undo step. The photo's{" "}
					<code>adjustments</code> key appears.
				</p>
			),
			done: (s) =>
				s.log.some(
					(entry) => entry.action === "setAdjustments" && entry.recorded,
				),
		},
		{
			title: "Go back to zero",
			body: (
				<p>
					Drag it back to 0 and let go. That's a change, so it's recorded, but
					look at what changed: <code>adjustments</code> is <em>left out</em>,
					not set to zeros. A neutral photo is exactly the object it was made
					as, so <code>hasEdits</code> can tell it's untouched.
				</p>
			),
			done: (s) =>
				s.log.some(
					(entry) =>
						entry.action === "setAdjustments" &&
						entry.recorded &&
						entry.after !== null &&
						!Array.isArray(entry.after) &&
						entry.after.type === "image" &&
						entry.after.adjustments === undefined,
				),
		},
		{
			title: "Change nothing",
			body: (
				<p>
					Pick the shape's current color, or drag a slider away and back before
					letting go. The model returns the very same object, so the store
					records nothing: there's no step to undo that did nothing.
				</p>
			),
			done: (s) => s.log.some((entry) => !entry.recorded),
		},
		{
			title: "Make the rectangle an arrow",
			body: (
				<p>
					Try it. <code>restyleShape</code> only switches between kinds with the
					same geometry: a rectangle to an ellipse, a line to an arrow. A
					rectangle has a width and height, an arrow a length, so the change is
					ignored and the same layer comes back.
				</p>
			),
			done: (s) =>
				s.log.some(
					(entry) =>
						entry.action === "setShapeStyle" &&
						!entry.recorded &&
						/line|arrow/.test(entry.detail),
				),
		},
		{
			title: "Undo a step",
			body: (
				<p>
					Undo a step. <code>past</code> holds whole documents, which sounds
					expensive, but each edit made a new document that shares every layer
					it didn't change. The "shared" count in the log shows how many layer
					objects carried over untouched.
				</p>
			),
			done: (s) => s.undone,
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "withAdjustments",
			file: "src/model/layers/image.ts",
			name: "withAdjustments",
		},
		{
			label: "restyleShape",
			file: "src/model/layers/shape.ts",
			name: "restyleShape",
		},
		{
			label: "reorderLayer",
			file: "src/model/layers/layer.ts",
			name: "reorderLayer",
		},
		{
			label: "resizeLayerBox",
			file: "src/model/layers/layer.ts",
			name: "resizeLayerBox",
		},
		{
			label: "setAdjustments",
			file: "src/model/edits/adjust.ts",
			name: "setAdjustments",
		},
		{
			label: "resizeBox",
			file: "src/model/edits/layers.ts",
			name: "resizeBox",
		},
		{
			label: "store: setDocument",
			file: "src/store/editorSlice.ts",
			name: "setDocument",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	const adjustmentSlider = (key: AdjustmentKey) => (
		<label key={key} className="slider">
			<span className="slider-label">{key}</span>
			<input
				type="range"
				min={-1}
				max={1}
				step={0.05}
				value={adjustments[key]}
				onChange={(event) =>
					setDraft({ ...adjustments, [key]: Number(event.target.value) })
				}
				onPointerUp={commitAdjustments}
				onKeyUp={commitAdjustments}
				onBlur={commitAdjustments}
			/>
			<output>{format(adjustments[key])}</output>
		</label>
	);

	return (
		<article className="lesson">
			<p className="eyebrow">The model · Lesson 3</p>
			<h1>Same object, or a new one</h1>
			<p className="lede">
				Model functions never change a layer in place. They return a new object,
				or, when nothing would change, the very same one. The store checks which
				with <code>===</code> and skips an edit that changed nothing, so it
				never records an undo step that does nothing.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<svg
							className="stage"
							viewBox={`-40 -40 ${document.width + 80} ${document.height + 80}`}
							role="img"
							aria-label="The photo and a shape, as the store holds them"
						>
							<DocumentScene document={shown} />
						</svg>
						<figcaption>
							<strong>The document the store holds.</strong> The photo's
							adjustments are drawn with the model's own{" "}
							<code>adjustmentMatrix</code>.
						</figcaption>
					</figure>

					<div className="pair">
						<section className="panel edits" aria-label="Edits">
							<h2>Edits</h2>
							<h3>The photo's adjustments</h3>
							{adjustmentKeys.map(adjustmentSlider)}

							<h3>The shape's style</h3>
							<div className="choice-row">
								{swatches.map((color) => (
									<button
										key={color}
										type="button"
										className={
											shape.color === color ? "swatch chosen" : "swatch"
										}
										style={{ background: color }}
										aria-label={`Color ${color}`}
										aria-pressed={shape.color === color}
										onClick={() => restyle({ color }, `color ${color}`)}
									/>
								))}
							</div>
							<div className="choice-row">
								{kinds.map((kind) => (
									<button
										key={kind}
										type="button"
										className={shape.shape === kind ? "chip chosen" : "chip"}
										aria-pressed={shape.shape === kind}
										onClick={() => restyle({ shape: kind }, `kind ${kind}`)}
									>
										{kind}
									</button>
								))}
							</div>
							<div className="choice-row">
								{widths.map((strokeWidth) => (
									<button
										key={strokeWidth}
										type="button"
										className={
											shape.strokeWidth === strokeWidth ? "chip chosen" : "chip"
										}
										aria-pressed={shape.strokeWidth === strokeWidth}
										onClick={() =>
											restyle({ strokeWidth }, `stroke ${strokeWidth}`)
										}
									>
										{strokeWidth}px
									</button>
								))}
							</div>

							<h3>Its size and place</h3>
							<div className="choice-row">
								<button
									type="button"
									className="chip"
									onClick={() => resize(shapeWidth, shapeHeight)}
								>
									Resize to{" "}
									{isLine(shape)
										? `length ${format(shapeWidth)}`
										: `${format(shapeWidth)} × ${format(shapeHeight)}`}
								</button>
								<button
									type="button"
									className="chip"
									onClick={() => resize(420, 260)}
								>
									Resize to {isLine(shape) ? "length 420" : "420 × 260"}
								</button>
								<button
									type="button"
									className="chip"
									onClick={() =>
										moveShape(document.layers.length - 1, "to top")
									}
								>
									Move to top
								</button>
								<button
									type="button"
									className="chip"
									onClick={() => moveShape(0, "to bottom")}
								>
									Move to bottom
								</button>
							</div>
						</section>

						<section className="panel verdict-panel" aria-label="The last edit">
							<h2>The last edit</h2>
							{last ? (
								<>
									<p
										className={last.recorded ? "identity new" : "identity same"}
									>
										<code className="identity-code">
											{last.after === null
												? "result === null"
												: last.recorded
													? "result !== input"
													: "result === input"}
										</code>
										<span>
											{last.recorded
												? "A new object: the store records a step."
												: last.after === null
													? "Nothing to change: the store records nothing."
													: "The same object: the store records nothing."}
										</span>
									</p>
									<p className="verdict-action">
										<code>{last.action}</code> {last.detail}
									</p>
									{last.recorded &&
										last.before &&
										last.after &&
										!Array.isArray(last.before) &&
										!Array.isArray(last.after) && (
											<ul className="change-list">
												{changes(last.before, last.after).map((change) => (
													<li key={change}>{change}</li>
												))}
											</ul>
										)}
									{last.recorded && Array.isArray(last.after) && (
										<ul className="change-list">
											<li>a new layers array, holding the same layers</li>
										</ul>
									)}
									{last.shared && (
										<p className="hint">
											{last.shared.same === last.shared.total
												? `The new document holds the same ${last.shared.total} layer objects as the one before: only the array around them is new.`
												: `The new document shares ${last.shared.same} of its ${last.shared.total} layers with the one before: only the edited layer is a new object.`}
										</p>
									)}
								</>
							) : (
								<p className="hint">
									Make an edit, and this shows whether the model handed back a
									new object.
								</p>
							)}
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={store} />
					</section>
					<section className="panel history" aria-label="History">
						<h2>History</h2>
						<div className="presets">
							<button
								type="button"
								className="button-small"
								disabled={store.past.length === 0}
								onClick={undo}
							>
								Undo
							</button>
							<button
								type="button"
								className="button-small"
								disabled={store.future.length === 0}
								onClick={redo}
							>
								Redo
							</button>
							<button
								type="button"
								className="button-small"
								onClick={() => {
									setStore(START);
									setDraft(null);
									setRun((value) => value + 1);
								}}
							>
								Start over
							</button>
						</div>
						<p className="history-counts">
							<code>past</code> {store.past.length} · <code>future</code>{" "}
							{store.future.length}
						</p>
						<ol className="log">
							{store.log.slice(0, 8).map((entry) => (
								<li
									key={entry.id}
									className={entry.recorded ? "recorded" : "skipped"}
								>
									<code>{entry.action}</code>
									<span>{entry.detail}</span>
									<small>
										{entry.recorded
											? `recorded${entry.shared ? ` · ${entry.shared.same}/${entry.shared.total} shared` : ""}`
											: "skipped"}
									</small>
								</li>
							))}
						</ol>
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					The model functions the edits above call, and the store actions that
					call them in the app. Each action asks the model, compares, and only
					then records.
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
						<h3>
							<code>===</code> is the cheapest diff
						</h3>
						<p>
							The store never compares layers field by field. The model decides
							whether an edit changes anything, because it knows what counts: a
							rectangle can't become an arrow, and zeroed adjustments are no
							adjustments.
						</p>
					</div>
					<div className="card">
						<h3>Undo keeps whole documents</h3>
						<p>
							Each step stores the document before it. That's affordable because
							a new document reuses every layer object it didn't change, so a
							hundred steps hold little more than the layers that were edited.
						</p>
					</div>
					<div className="card">
						<h3>Caches can key on objects</h3>
						<p>
							A layer that never changes in place can be a cache key.{" "}
							<code>drawingBox</code>, <code>shapeOutline</code>, and the text
							layout keep results in <code>WeakMap</code>s keyed by the layer or
							its strokes; an edited layer is a new key, and the old entry is
							collected with it.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
