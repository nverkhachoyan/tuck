import {
	createDocumentFromImage,
	type EditorDocument,
} from "@src/editor/document/document.ts";
import {
	documentFraming,
	type Framing,
	framingAnchor,
	reframeDocument,
} from "@src/editor/document/framing.ts";
import {
	type Size,
	toDocumentSpace,
	toLayerSpace,
} from "@src/editor/document/geometry.ts";
import type { Layer } from "@src/editor/layers/layer.ts";
import { createRedactionBox } from "@src/editor/layers/redaction/redaction.ts";
import { createShapeLayer } from "@src/editor/layers/shape/shape.ts";
import { createTextLayer } from "@src/editor/layers/text/text.ts";
import {
	boxWithRatio,
	type CropState,
	cropFraming,
	flipCrop,
	MAX_STRAIGHTEN,
	resetCrop,
	rotateLeft,
	startCrop,
	straightenTo,
} from "@src/editor/tools/crop/cropGeometry.ts";
import { useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { format } from "../../ui/format.ts";
import { DocumentScene, layerBox } from "./layerViews.tsx";

const startDocument: EditorDocument = (() => {
	const document = createDocumentFromImage("photo.jpg", 1200, 900, true);
	const caption = createTextLayer(document, "Golden hour");
	return {
		...document,
		layers: [
			...document.layers,
			{ ...caption, transform: { ...caption.transform, y: 720 } },
			// Over the sun.
			createRedactionBox(
				{ x: 130, y: 115, width: 220, height: 220 },
				{ type: "blur", radius: 22 },
			),
			// Pointing at the far hill.
			createShapeLayer(
				"arrow",
				{ x: 760, y: 250, rotation: 0.76, width: 300, height: 0 },
				{ color: "#FF3B30", strokeWidth: 14 },
			),
		],
	};
})();

type Operation =
	| "rotateLeft"
	| "flipCrop"
	| "straightenTo"
	| "boxWithRatio"
	| "expand"
	| "resetCrop";

type FramingState = {
	document: EditorDocument;
	turnLayers: boolean;
	// The last crop: the crop tool's state, and the framing it gave.
	last: { operation: Operation; crop: CropState; framing: Framing } | null;
	// What the reader has tried, for the checklist.
	tried: Set<string>;
};

const START: FramingState = {
	document: startDocument,
	turnLayers: false,
	last: null,
	tried: new Set(),
};

function layerLabel(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return "The photo";
		case "text":
			return `“${layer.text}”`;
		case "redaction":
			return "Redaction";
		case "shape":
			return `Shape · ${layer.shape}`;
		case "drawing":
			return "Drawing";
	}
}

/**
 * A layer's center on the photo: in the photo's own pixels from its middle,
 * as if it were never mirrored. Reframing keeps this where it is.
 */
function spotOnPhoto(document: EditorDocument, layer: Layer) {
	const anchor = framingAnchor(document);
	const local = toLayerSpace(anchor.transform, layer.transform);
	return { x: anchor.flipped ? -local.x : local.x, y: local.y };
}

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);
// Spots come back through a turn and its inverse: hide the float noise.
const round = (value: number) => Math.round(value * 100) / 100;

export function FramingLesson() {
	const [state, setState] = useState<FramingState>(START);
	const [run, setRun] = useState(0);
	// The document as the straighten slider was grabbed: straightening always
	// starts from it, so returning to its angle restores it exactly.
	const [grabbed, setGrabbed] = useState<EditorDocument | null>(null);
	const [tabName, setTabName] = useState("reframeDocument");

	const { document, turnLayers, last } = state;
	const anchor = framingAnchor(document);
	const photoLayer = document.layers.find((layer) => layer.id === "photo");
	const crop = startCrop(document);

	/**
	 * One crop, start to finish, the way the crop tool does it: the crop
	 * state that reproduces the current framing, one change to it, the
	 * framing that gives, and the document reframed to it.
	 */
	const reframe = (
		operation: Operation,
		change: (crop: CropState, photo: Size) => CropState,
		from: EditorDocument = document,
	) =>
		setState((current) => {
			const base = from;
			const anchor = framingAnchor(base);
			const photo = { width: anchor.width, height: anchor.height };
			const next = change(startCrop(base), photo);
			const framing = cropFraming(
				next,
				photo,
				anchor.transform.scaleX,
				base.background,
			);
			const tried = new Set(current.tried);
			tried.add(operation);
			if (operation === "rotateLeft" && current.turnLayers) {
				tried.add("rotate turning layers");
			}
			if (operation === "rotateLeft" && anchor.layer === null) {
				tried.add("rotate the canvas");
			}
			return {
				...current,
				document: reframeDocument(base, framing, current.turnLayers),
				last: { operation, crop: next, framing },
				tried,
			};
		});

	const setPhotoLocked = (locked: boolean) =>
		setState((current) => ({
			...current,
			document: {
				...current.document,
				layers: current.document.layers.map((layer) =>
					layer.id === "photo" ? { ...layer, locked } : layer,
				),
			},
		}));

	const steps: FlowStep<FramingState>[] = [
		{
			title: "Turn the photo",
			body: (
				<p>
					Press <strong>Rotate left</strong>. The canvas becomes 900 × 1200 and
					the photo turns, and every other layer moves to stay over the same
					spot on the photo: the table's last column doesn't change. The text
					and arrow keep their angle on the canvas, but the redaction turned
					anyway, as redactions always do: upright over a turned face, its
					corners would show what it hides.
				</p>
			),
			done: (s) => s.tried.has("rotateLeft"),
		},
		{
			title: "Turn the layers too",
			body: (
				<p>
					Switch on <strong>Turn layers with the photo</strong> and rotate
					again. Now every layer turns along: that's <code>turnLayers</code>,
					the crop tool's choice, passed to <code>rebaseTransform</code> for
					each layer.
				</p>
			),
			done: (s) => s.tried.has("rotate turning layers"),
		},
		{
			title: "Mirror it",
			body: (
				<p>
					Press <strong>Flip</strong>. The photo mirrors, and the layers move to
					their mirrored spots, but none of them is mirrored itself: the text
					stays readable. Only the anchor's <code>flipped</code> changes.
				</p>
			),
			done: (s) => s.tried.has("flipCrop"),
		},
		{
			title: "Straighten",
			body: (
				<p>
					Drag <strong>straighten</strong>. The crop box shrinks as the photo
					turns, so no transparent corner ever shows (<code>straightenTo</code>
					), and the canvas gets smaller with it. Every value starts from the
					document as you grabbed the slider, so dragging back to where you
					started restores it exactly.
				</p>
			),
			done: (s) => s.tried.has("straightenTo"),
		},
		{
			title: "Crop to a square",
			body: (
				<p>
					Press <strong>Square</strong>. <code>boxWithRatio</code> fits the
					largest square in the crop box, and <code>cropFraming</code> turns the
					box into a canvas size and a place for the photo on it, in whole
					pixels.
				</p>
			),
			done: (s) => s.tried.has("boxWithRatio"),
		},
		{
			title: "Unlock the photo, then turn",
			body: (
				<p>
					Unlock the photo and rotate. With no locked photo,{" "}
					<code>framingAnchor</code> lets the canvas stand in for one, so the
					canvas turns and the photo follows like any other layer. That's how a
					blank canvas, with photos added to it, crops too.
				</p>
			),
			done: (s) => s.tried.has("rotate the canvas"),
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "reframeDocument",
			file: "src/editor/document/framing.ts",
			name: "reframeDocument",
		},
		{
			label: "rebaseTransform",
			file: "src/editor/document/framing.ts",
			name: "rebaseTransform",
		},
		{
			label: "framingAnchor",
			file: "src/editor/document/framing.ts",
			name: "framingAnchor",
		},
		{
			label: "turnsWithPhoto",
			file: "src/editor/document/framing.ts",
			name: "turnsWithPhoto",
		},
		{
			label: "startCrop",
			file: "src/editor/tools/crop/cropGeometry.ts",
			name: "startCrop",
		},
		{
			label: "rotateLeft",
			file: "src/editor/tools/crop/cropGeometry.ts",
			name: "rotateLeft",
		},
		{
			label: "flipCrop",
			file: "src/editor/tools/crop/cropGeometry.ts",
			name: "flipCrop",
		},
		{
			label: "cropFraming",
			file: "src/editor/tools/crop/cropGeometry.ts",
			name: "cropFraming",
		},
		{
			label: "reframe",
			file: "src/editor/document/documentEdits.ts",
			name: "reframe",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	// Fit any canvas the crops make in one 4:3 frame, so the page doesn't jump.
	const frameWidth = Math.max(document.width, (document.height * 4) / 3) * 1.12;
	const frameHeight = (frameWidth * 3) / 4;
	const viewBox = `${(document.width - frameWidth) / 2} ${(document.height - frameHeight) / 2} ${frameWidth} ${frameHeight}`;

	const anchorBox = anchor.layer ? layerBox(anchor.layer) : null;
	const anchorOutline = anchorBox
		? [
				{ x: -anchorBox.halfWidth, y: -anchorBox.halfHeight },
				{ x: anchorBox.halfWidth, y: -anchorBox.halfHeight },
				{ x: anchorBox.halfWidth, y: anchorBox.halfHeight },
				{ x: -anchorBox.halfWidth, y: anchorBox.halfHeight },
			]
				.map((corner) => toDocumentSpace(anchor.transform, corner))
				.map(({ x, y }) => `${x},${y}`)
				.join(" ")
		: `0,0 ${document.width},0 ${document.width},${document.height} 0,${document.height}`;

	const framing = documentFraming(document);
	const straighten = degrees(crop.straighten);

	return (
		<article className="lesson">
			<p className="eyebrow">The document · Lesson 5</p>
			<h1>Cropping moves an anchor</h1>
			<p className="lede">
				Cropping, turning, flipping, and straightening are one operation: give
				the <strong>anchor</strong>, the photo the canvas is framed around, a
				new place on a new canvas. Every other layer follows it, keeping its
				spot on the photo. The buttons below run the crop tool's own geometry,
				then the model's <code>reframeDocument</code>.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<svg
							className="stage framing-stage"
							viewBox={viewBox}
							role="img"
							aria-label={`The document, ${document.width} by ${document.height}`}
						>
							<DocumentScene document={document} />
							<polygon className="anchor-outline" points={anchorOutline} />
						</svg>
						<figcaption>
							<strong>
								{document.width} × {document.height}.
							</strong>{" "}
							The dashed outline is the anchor:{" "}
							{anchor.layer
								? "the lowest visible locked image, the photo."
								: "no image is locked, so the canvas stands in for one."}
						</figcaption>
					</figure>

					<div className="pair">
						<section className="panel spots" aria-label="Where the layers are">
							<h2>Where the layers are</h2>
							<table>
								<thead>
									<tr>
										<th scope="col">Layer</th>
										<th scope="col">On the canvas</th>
										<th scope="col">On the photo</th>
									</tr>
								</thead>
								<tbody>
									{document.layers
										.filter((layer) => layer !== anchor.layer)
										.map((layer) => {
											const spot =
												photoLayer && anchor.layer === photoLayer
													? spotOnPhoto(document, layer)
													: null;
											return (
												<tr key={layer.id}>
													<th scope="row">{layerLabel(layer)}</th>
													<td>
														{format(layer.transform.x)},{" "}
														{format(layer.transform.y)}
														<small>{degrees(layer.transform.rotation)}°</small>
													</td>
													<td>
														{spot ? (
															`${format(round(spot.x))}, ${format(round(spot.y))}`
														) : (
															<small>moves with the canvas</small>
														)}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
							<p className="hint">
								"On the photo" is each layer's center in the photo's own pixels,
								from its middle, as if it were never mirrored. Reframing never
								changes it.
							</p>
						</section>

						<section className="panel pipeline" aria-label="The last crop">
							<h2>The last crop</h2>
							<ol className="pipeline-steps">
								<li>
									<code>startCrop(document)</code>
									<small className="step-note">
										the crop that reproduces the current framing
									</small>
								</li>
								<li>
									<code>{last ? last.operation : "…"}</code>
									<small className="step-note">one change to it</small>
								</li>
								<li>
									<code>cropFraming(…)</code>
									<small className="step-note">
										the canvas, and the anchor's place on it
									</small>
								</li>
								<li>
									<code>reframeDocument(…)</code>
									<small className="step-note">
										the anchor moves; every other layer follows
									</small>
								</li>
							</ol>
							<dl>
								<dt>crop</dt>
								<dd>
									{crop.quarterTurns} quarter turns, straighten {straighten}°,
									{crop.flipped ? " flipped" : " not flipped"}
								</dd>
								<dt>framing</dt>
								<dd>
									{framing.width} × {framing.height}, anchor at{" "}
									{format(framing.transform.x)}, {format(framing.transform.y)},{" "}
									{degrees(framing.transform.rotation)}°
									{framing.flipped ? ", flipped" : ""}
								</dd>
							</dl>
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={state} />
					</section>
					<section className="panel controls" aria-label="Crop">
						<h2>Crop</h2>
						<div className="choice-row">
							<button
								type="button"
								className="chip"
								onClick={() => reframe("rotateLeft", rotateLeft)}
							>
								Rotate left
							</button>
							<button
								type="button"
								className="chip"
								onClick={() => reframe("flipCrop", flipCrop)}
							>
								Flip
							</button>
							<button
								type="button"
								className="chip"
								onClick={() =>
									reframe("boxWithRatio", (current) => ({
										...current,
										box: boxWithRatio(current.box, 1),
									}))
								}
							>
								Square
							</button>
							<button
								type="button"
								className="chip"
								onClick={() =>
									reframe("expand", (current) => {
										const { x, y, width, height } = current.box;
										const grow = Math.min(width, height) * 0.1;
										return {
											...current,
											box: {
												x: x - grow,
												y: y - grow,
												width: width + grow * 2,
												height: height + grow * 2,
											},
										};
									})
								}
							>
								Expand canvas
							</button>
							<button
								type="button"
								className="chip"
								onClick={() =>
									reframe("resetCrop", (_, photo) => resetCrop(photo))
								}
							>
								Reset
							</button>
						</div>
						<label className="slider">
							<span className="slider-label">straighten</span>
							<input
								type="range"
								min={degrees(-MAX_STRAIGHTEN)}
								max={degrees(MAX_STRAIGHTEN)}
								step={1}
								value={straighten}
								onChange={(event) => {
									const base = grabbed ?? document;
									if (!grabbed) setGrabbed(document);
									const angle = (Number(event.target.value) * Math.PI) / 180;
									reframe(
										"straightenTo",
										(current, photo) => straightenTo(current, angle, photo),
										base,
									);
								}}
								onPointerUp={() => setGrabbed(null)}
								onKeyUp={() => setGrabbed(null)}
								onBlur={() => setGrabbed(null)}
							/>
							<output>{straighten}°</output>
						</label>
						<label className="toggle">
							<input
								type="checkbox"
								checked={turnLayers}
								onChange={(event) => {
									const checked = event.target.checked;
									setState((current) => ({ ...current, turnLayers: checked }));
								}}
							/>
							Turn layers with the photo
						</label>
						<label className="toggle">
							<input
								type="checkbox"
								checked={photoLayer?.locked ?? false}
								onChange={(event) => setPhotoLocked(event.target.checked)}
							/>
							The photo is locked
						</label>
						<div className="presets">
							<button
								type="button"
								className="button-small"
								onClick={() => {
									setState(START);
									setGrabbed(null);
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
					The model's side of a crop, the crop tool's geometry that feeds it,
					and the edit the store makes with them.
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
						<h3>One operation, not five</h3>
						<p>
							Crop, turn, flip, straighten, and expand all end in a{" "}
							<code>Framing</code>: a canvas size and a place for the anchor.
							The model only has to know how to move everything else after it,
							once.
						</p>
					</div>
					<div className="card">
						<h3>One matrix per crop</h3>
						<p>
							<code>rebaseTransform</code> builds a single map: undo the old
							placement, mirror if the flip changed, apply the new one. If the
							anchor didn't move, the layers aren't touched at all, not even
							rounded.
						</p>
					</div>
					<div className="card">
						<h3>Locked means "frame around me"</h3>
						<p>
							A document's own photo starts locked and photos added later don't,
							so the first photo is what gets cropped. Unlock it, and the canvas
							itself becomes the anchor.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
