import { type AdjustmentKey, adjustmentKeys } from "@model/adjustments.ts";
import {
	type EditorDocument,
	type Layer,
	type RedactionEffect,
	type TextFont,
	textFonts,
	withAdjustments,
} from "@model/document.ts";
import { Fill, Group, Paint, type SkImage } from "@shopify/react-native-skia";
import { DocumentRenderScene } from "@src/render/DocumentRenderScene.tsx";
import { DrawingLayerView } from "@src/render/layers/DrawingLayerView.tsx";
import { ImageLayerView } from "@src/render/layers/ImageLayerView.tsx";
import { RedactionLayerView } from "@src/render/layers/RedactionLayerView.tsx";
import { ShapeLayerView } from "@src/render/layers/ShapeLayerView.tsx";
import { TextLayerView } from "@src/render/layers/TextLayerView.tsx";
import { toTransformList } from "@src/render/layerTransform.ts";
import { useEffect, useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { format } from "../../ui/format.ts";
import { SkiaStage } from "./SkiaStage.tsx";
import { layerLabel, makeSample, type Sample } from "./sampleDocument.ts";

/**
 * The same layers as `DocumentRenderScene`, each drawn inside a saved layer
 * of its own: what the app deliberately doesn't do. A backdrop filter reads
 * only the layer it's drawn in, so a redaction in its own layer has nothing
 * under it to hide.
 */
function SavedLayersScene({
	document,
	images,
}: {
	document: EditorDocument;
	images: Map<string, SkImage>;
}) {
	return (
		<Group>
			<Fill blendMode="clear" />
			{document.layers.map((layer) =>
				layer.hidden ? null : (
					<Group
						key={layer.id}
						layer={<Paint />}
						transform={toTransformList(layer.transform)}
					>
						{layer.type === "image" ? (
							<ImageLayerView
								layer={layer}
								image={images.get(layer.uri) as SkImage}
							/>
						) : layer.type === "text" ? (
							<TextLayerView layer={layer} />
						) : layer.type === "drawing" ? (
							<DrawingLayerView layer={layer} />
						) : layer.type === "redaction" ? (
							<RedactionLayerView layer={layer} />
						) : (
							<ShapeLayerView layer={layer} />
						)}
					</Group>
				),
			)}
		</Group>
	);
}

type Progress = {
	selected: Layer | undefined;
	tried: Set<string>;
};

const effects: { label: string; effect: RedactionEffect }[] = [
	{ label: "blur", effect: { type: "blur", radius: 22 } },
	{ label: "pixelate", effect: { type: "pixelate", size: 36 } },
	{ label: "solid", effect: { type: "solid", color: "#111111" } },
];

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);

export default function LayersLesson() {
	const [sample, setSample] = useState<Sample | null>(null);
	const [document, setDocument] = useState<EditorDocument | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [savedLayers, setSavedLayers] = useState(false);
	const [tried, setTried] = useState<Set<string>>(new Set());
	const [tabName, setTabName] = useState("DocumentRenderScene");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let made: Sample | null = null;
		makeSample()
			.then((result) => {
				made = result;
				setSample(result);
				setDocument(result.document);
				setSelectedId(
					result.document.layers.find((layer) => layer.type === "redaction")
						?.id ?? null,
				);
			})
			.catch((reason: unknown) => setError(String(reason)));
		return () => made?.release();
	}, []);

	if (error) return <p className="hint">Couldn't make the photo: {error}</p>;
	if (!sample || !document) return <p className="hint">Decoding the photo…</p>;

	const selected = document.layers.find((layer) => layer.id === selectedId);
	const mark = (what: string) =>
		setTried((current) =>
			current.has(what) ? current : new Set(current).add(what),
		);
	const update = (id: string, change: (layer: Layer) => Layer) =>
		setDocument((current) =>
			current
				? {
						...current,
						layers: current.layers.map((layer) =>
							layer.id === id ? change(layer) : layer,
						),
					}
				: current,
		);

	const steps: FlowStep<Progress>[] = [
		{
			title: "Pick a redaction",
			body: (
				<p>
					Select the blur over the sun. <code>RedactionLayerView</code> draws a
					box redaction as a <code>BackdropFilter</code> clipped to its box: it
					draws nothing of its own, but filters what's already been drawn under
					it.
				</p>
			),
			done: ({ selected }) => selected?.type === "redaction",
		},
		{
			title: "Turn it",
			body: (
				<p>
					Turn or scale the selected layer. Each layer is drawn inside a{" "}
					<code>Group</code> with <code>toTransformList(transform)</code>:
					translate, rotate, scale, the same five numbers as the model's first
					lesson, in Skia's form. The blur keeps its strength, because its sigma
					is divided by the layer's scale.
				</p>
			),
			done: ({ tried }) => tried.has("transform"),
		},
		{
			title: "Pixelate it",
			body: (
				<p>
					Switch the redaction to <strong>pixelate</strong> and change its size.
					Skia has no pixelation filter, and its web build no runtime filters,
					so <code>pixelateFilter</code> builds one from a blur and displacement
					maps that every platform has.
				</p>
			),
			done: ({ tried }) => tried.has("pixelate"),
		},
		{
			title: "Wrap each layer in a saved layer",
			body: (
				<p>
					Turn on <strong>Each layer in a saved layer</strong>. The redactions
					stop hiding anything: a backdrop filter reads only the layer it's
					drawn in, and each one's own layer is empty. That's why the editor and
					export draw every layer straight onto the canvas.
				</p>
			),
			done: ({ tried }) => tried.has("saved layers"),
		},
		{
			title: "Adjust the photo",
			body: (
				<p>
					Select the photo and move a slider. <code>ImageLayerView</code> colors
					it with <code>adjustmentMatrix</code>, the matrix the SVG lessons used
					too, here as a Skia <code>ColorMatrix</code>.
				</p>
			),
			done: ({ tried }) => tried.has("adjust"),
		},
		{
			title: "Change the caption's font",
			body: (
				<p>
					Select the caption and pick another font. Text is a Skia paragraph
					laid out with the app's five bundled fonts, registered in{" "}
					<code>fonts.ts</code>: CanvasKit has no system fonts, and bundling
					them is what makes an export look the same everywhere.
				</p>
			),
			done: ({ tried }) => tried.has("font"),
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "DocumentRenderScene",
			file: "src/render/DocumentRenderScene.tsx",
			name: "DocumentRenderScene",
		},
		{
			label: "LayerContent",
			file: "src/render/DocumentRenderScene.tsx",
			name: "LayerContent",
		},
		{
			label: "toTransformList",
			file: "src/render/layerTransform.ts",
			name: "toTransformList",
		},
		{
			label: "RedactionLayerView",
			file: "src/render/layers/RedactionLayerView.tsx",
			name: "RedactionLayerView",
		},
		{
			label: "pixelateFilter",
			file: "src/render/layers/RedactionLayerView.tsx",
			name: "pixelateFilter",
		},
		{
			label: "ImageLayerView",
			file: "src/render/layers/ImageLayerView.tsx",
			name: "ImageLayerView",
		},
		{
			label: "TextLayerView",
			file: "src/render/layers/TextLayerView.tsx",
			name: "TextLayerView",
		},
		{
			label: "loadSkiaFonts",
			file: "src/render/fonts.ts",
			name: "loadSkiaFonts",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];
	const topFirst = [...document.layers].reverse();

	return (
		<article className="lesson">
			<p className="eyebrow">Rendering · Lesson 1</p>
			<h1>From layer to pixels</h1>
			<p className="lede">
				This canvas is Skia, running as CanvasKit in your browser, drawing the
				document with the app's own <code>render/</code> code: the scene export
				draws, <code>DocumentRenderScene</code>, and each layer type's view.
				Pick a layer and change it; every pixel below comes from the app.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<SkiaStage width={document.width} height={document.height}>
							{savedLayers ? (
								<SavedLayersScene document={document} images={sample.images} />
							) : (
								<DocumentRenderScene
									document={document}
									images={sample.images}
								/>
							)}
						</SkiaStage>
						<figcaption>
							<strong>Skia, live.</strong>{" "}
							{savedLayers
								? "Each layer drawn in a saved layer of its own: the redactions have nothing to read."
								: "The app's DocumentRenderScene, the scene export renders offscreen."}
						</figcaption>
					</figure>

					<div className="pair">
						<section className="panel layers-panel" aria-label="Layers">
							<h2>Layers</h2>
							<ol className="layer-list">
								{topFirst.map((layer) => {
									const chosen = layer.id === selectedId;
									return (
										<li
											key={layer.id}
											className={chosen ? "chosen" : undefined}
										>
											<button
												type="button"
												className="layer-name"
												aria-pressed={chosen}
												onClick={() => setSelectedId(layer.id)}
											>
												<span>{layerLabel(layer)}</span>
												<small>
													{layer.type === "image"
														? "ImageLayerView"
														: layer.type === "text"
															? "TextLayerView"
															: layer.type === "drawing"
																? "DrawingLayerView"
																: layer.type === "redaction"
																	? "RedactionLayerView"
																	: "ShapeLayerView"}
												</small>
											</button>
										</li>
									);
								})}
							</ol>
							<label className="toggle">
								<input
									type="checkbox"
									checked={savedLayers}
									onChange={(event) => {
										setSavedLayers(event.target.checked);
										if (event.target.checked) mark("saved layers");
									}}
								/>
								Each layer in a saved layer
							</label>
						</section>

						<section className="panel inspector" aria-label="Selected layer">
							{selected ? (
								<>
									<h2>{layerLabel(selected)}</h2>
									<p className="transform-list">
										<code>toTransformList</code>
										<span className="transform-values">
											translateX {format(selected.transform.x)}, translateY{" "}
											{format(selected.transform.y)}, rotate{" "}
											{format(selected.transform.rotation)}, scaleX{" "}
											{format(selected.transform.scaleX)}, scaleY{" "}
											{format(selected.transform.scaleY)}
										</span>
									</p>
									<label className="slider">
										<span className="slider-label">rotation</span>
										<input
											type="range"
											min={-180}
											max={180}
											step={1}
											value={degrees(selected.transform.rotation)}
											onChange={(event) => {
												const rotation =
													(Number(event.target.value) * Math.PI) / 180;
												update(selected.id, (layer) => ({
													...layer,
													transform: { ...layer.transform, rotation },
												}));
												mark("transform");
											}}
										/>
										<output>{degrees(selected.transform.rotation)}°</output>
									</label>
									<label className="slider">
										<span className="slider-label">scale</span>
										<input
											type="range"
											min={0.3}
											max={2.5}
											step={0.05}
											value={selected.transform.scaleX}
											onChange={(event) => {
												const scale = Number(event.target.value);
												update(selected.id, (layer) => ({
													...layer,
													transform: {
														...layer.transform,
														scaleX: scale,
														scaleY: scale,
													},
												}));
												mark("transform");
											}}
										/>
										<output>{format(selected.transform.scaleX)}</output>
									</label>

									{selected.type === "redaction" && (
										<>
											<div className="choice-row">
												{effects.map(({ label, effect }) => (
													<button
														key={label}
														type="button"
														className={
															selected.effect.type === effect.type
																? "chip chosen"
																: "chip"
														}
														onClick={() => {
															update(selected.id, (layer) => ({
																...layer,
																effect,
															}));
															if (effect.type === "pixelate") mark("pixelate");
														}}
													>
														{label}
													</button>
												))}
											</div>
											{selected.effect.type !== "solid" && (
												<label className="slider">
													<span className="slider-label">
														{selected.effect.type === "blur"
															? "radius"
															: "size"}
													</span>
													<input
														type="range"
														min={4}
														max={80}
														step={1}
														value={
															selected.effect.type === "blur"
																? selected.effect.radius
																: selected.effect.size
														}
														onChange={(event) => {
															const value = Number(event.target.value);
															update(selected.id, (layer) =>
																layer.type === "redaction" &&
																layer.effect.type !== "solid"
																	? {
																			...layer,
																			effect:
																				layer.effect.type === "blur"
																					? { type: "blur", radius: value }
																					: { type: "pixelate", size: value },
																		}
																	: layer,
															);
															if (selected.effect.type === "pixelate") {
																mark("pixelate");
															}
														}}
													/>
													<output>
														{selected.effect.type === "blur"
															? selected.effect.radius
															: selected.effect.size}
													</output>
												</label>
											)}
										</>
									)}

									{selected.type === "image" &&
										adjustmentKeys.map((key: AdjustmentKey) => (
											<label key={key} className="slider">
												<span className="slider-label">{key}</span>
												<input
													type="range"
													min={-1}
													max={1}
													step={0.05}
													value={selected.adjustments?.[key] ?? 0}
													onChange={(event) => {
														const value = Number(event.target.value);
														update(selected.id, (layer) =>
															layer.type === "image"
																? withAdjustments(layer, {
																		brightness: 0,
																		contrast: 0,
																		saturation: 0,
																		temperature: 0,
																		...layer.adjustments,
																		[key]: value,
																	})
																: layer,
														);
														mark("adjust");
													}}
												/>
												<output>
													{format(selected.adjustments?.[key] ?? 0)}
												</output>
											</label>
										))}

									{selected.type === "text" && (
										<div className="choice-row">
											{textFonts.map((font: TextFont) => (
												<button
													key={font}
													type="button"
													className={
														selected.font === font ? "chip chosen" : "chip"
													}
													onClick={() => {
														update(selected.id, (layer) =>
															layer.type === "text"
																? { ...layer, font }
																: layer,
														);
														mark("font");
													}}
												>
													{font}
												</button>
											))}
										</div>
									)}
								</>
							) : (
								<p className="hint">Select a layer to change it.</p>
							)}
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow steps={steps} state={{ selected, tried }} />
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					The render code drawing the canvas above, from{" "}
					<code>src/render/</code>.
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
						<h3>Plain props, any document</h3>
						<p>
							The views take a layer and its decoded images, and never read the
							store. That's why the editor, the crop tool, export, and these
							docs can all draw with them.
						</p>
					</div>
					<div className="card">
						<h3>Effects that run everywhere</h3>
						<p>
							Skia's web build lacks runtime shaders and matrix image filters,
							so every effect is built from filters all three platforms share:
							blur, displacement, offset, and morphology.
						</p>
					</div>
					<div className="card">
						<h3>Strength in document pixels</h3>
						<p>
							Skia maps a filter through the canvas's transform. A redaction's
							sigma is divided by its layer's scale, so resizing it, or zooming
							the editor, never weakens it.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
