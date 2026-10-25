import { type EditorDocument, hasTransparency } from "@model/document.ts";
import { DocumentRenderScene } from "@src/render/DocumentRenderScene.tsx";
import { renderDocument } from "@src/render/renderDocument.tsx";
import {
	type ExportFormat,
	encodeImage,
	exportFormatFor,
	exportFormats,
} from "@src/screens/export/exportFormat.ts";
import {
	type ExportSize,
	exportSizes,
} from "@src/screens/export/exportSizes.ts";
import { useEffect, useRef, useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { SkiaStage } from "./SkiaStage.tsx";
import { makeSample, type Sample } from "./sampleDocument.ts";

type Exported = {
	url: string;
	format: ExportFormat;
	width: number;
	height: number;
	bytes: number;
	milliseconds: number;
	scale: number;
	photoHidden: boolean;
	background: string | null;
	// The same pixels in the format export didn't pick, for comparison.
	other: { format: ExportFormat; bytes: number };
};

type Progress = { exports: Exported[] };

const backgrounds: { label: string; value: string | null }[] = [
	{ label: "None", value: null },
	{ label: "White", value: "#FFFFFF" },
	{ label: "Black", value: "#111111" },
];

function kilobytes(bytes: number): string {
	return bytes > 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(2)} MB`
		: `${Math.round(bytes / 1024)} KB`;
}

export default function ExportLesson() {
	const [sample, setSample] = useState<Sample | null>(null);
	const [document, setDocument] = useState<EditorDocument | null>(null);
	const [size, setSize] = useState(0);
	const [exports, setExports] = useState<Exported[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tabName, setTabName] = useState("renderDocument");
	const urls = useRef<string[]>([]);

	useEffect(() => {
		let made: Sample | null = null;
		makeSample()
			.then((result) => {
				made = result;
				setSample(result);
				setDocument(result.document);
			})
			.catch((reason: unknown) => setError(String(reason)));
		return () => {
			made?.release();
			for (const url of urls.current) URL.revokeObjectURL(url);
		};
	}, []);

	if (error) return <p className="hint">Couldn't export: {error}</p>;
	if (!sample || !document) return <p className="hint">Decoding the photo…</p>;

	const sizes = exportSizes(document);
	const chosen: ExportSize = sizes[Math.min(size, sizes.length - 1)];
	const format = exportFormatFor(document);
	const photo = document.layers.find((layer) => layer.id === "photo");
	const last = exports[0];

	const exportNow = async () => {
		setBusy(true);
		try {
			const started = performance.now();
			// What the export screen does: render, then encode as the format the
			// document calls for.
			const image = await renderDocument(document, chosen.scale);
			const bytes = encodeImage(image, format);
			const milliseconds = performance.now() - started;
			const otherFormat: ExportFormat = format === "png" ? "jpeg" : "png";
			const other = {
				format: otherFormat,
				bytes: encodeImage(image, otherFormat).byteLength,
			};
			const width = image.width();
			const height = image.height();
			image.dispose();
			const url = URL.createObjectURL(
				new Blob([bytes as Uint8Array<ArrayBuffer>], {
					type: exportFormats[format].mimeType,
				}),
			);
			urls.current.push(url);
			setExports((previous) => [
				{
					url,
					format,
					width,
					height,
					bytes: bytes.byteLength,
					milliseconds,
					scale: chosen.scale,
					photoHidden: photo?.hidden ?? false,
					background: document.background,
					other,
				},
				...previous,
			]);
		} catch (reason) {
			setError(String(reason));
		} finally {
			setBusy(false);
		}
	};

	const steps: FlowStep<Progress>[] = [
		{
			title: "Export it",
			body: (
				<p>
					Press <strong>Export</strong>. <code>renderDocument</code> decodes
					every image the visible layers draw, draws{" "}
					<code>DocumentRenderScene</code> offscreen with{" "}
					<code>drawOffscreen</code> (Skia's <code>drawAsImage</code>, or on web
					one surface kept between drawings), at the document's own size, and{" "}
					<code>encodeImage</code> makes a JPEG. The scene is the one on the
					left, so the file can't differ from what you saw.
				</p>
			),
			done: ({ exports }) => exports.length > 0,
		},
		{
			title: "Export a smaller size",
			body: (
				<p>
					Pick the smaller size and export again. <code>exportSizes</code>{" "}
					offers the full size, capped at 25 megapixels, then 2048 and 1080
					pixels on the longer side when they're smaller. The scene is drawn
					scaled, so text, shapes, and redactions are redrawn sharp at that
					size, not shrunk from a bigger render.
				</p>
			),
			done: ({ exports }) => exports.some((exported) => exported.scale < 1),
		},
		{
			title: "Hide the photo",
			body: (
				<p>
					Hide the photo and export. With nothing covering the canvas,{" "}
					<code>hasTransparency</code> is true, and <code>exportFormatFor</code>{" "}
					picks PNG: JPEG can't keep transparent pixels.
				</p>
			),
			done: ({ exports }) =>
				exports.some(
					(exported) => exported.photoHidden && exported.format === "png",
				),
		},
		{
			title: "Give the canvas a background",
			body: (
				<p>
					Keep the photo hidden, pick a background, and export. A filled canvas
					has nothing transparent, so it's a JPEG again.
				</p>
			),
			done: ({ exports }) =>
				exports.some(
					(exported) =>
						exported.photoHidden &&
						exported.background !== null &&
						exported.format === "jpeg",
				),
		},
		{
			title: "Compare the formats",
			body: (
				<p>
					Show the photo again and export. The list's last column encodes the
					very same pixels in the other format. With a photo in it, the PNG
					comes out bigger, and with a real camera photo's noise, several times
					bigger, which is why export only uses PNG when it must.
				</p>
			),
			done: ({ exports }) =>
				exports.some((exported) => exported.format === "png") &&
				exports.some(
					(exported) => !exported.photoHidden && exported.format === "jpeg",
				),
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "renderDocument",
			file: "src/render/renderDocument.tsx",
			name: "renderDocument",
		},
		{
			label: "decodeImageLayers",
			file: "src/render/decodeImageLayers.ts",
			name: "decodeImageLayers",
		},
		{
			label: "decodedImages",
			file: "src/render/decodedImages.ts",
			name: "decodedImages",
		},
		{
			label: "exportSizes",
			file: "src/screens/export/exportSizes.ts",
			name: "exportSizes",
		},
		{
			label: "exportFormatFor",
			file: "src/screens/export/exportFormat.ts",
			name: "exportFormatFor",
		},
		{
			label: "encodeImage",
			file: "src/screens/export/exportFormat.ts",
			name: "encodeImage",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	return (
		<article className="lesson">
			<p className="eyebrow">Rendering · Lesson 2</p>
			<h1>Export is the same scene, offscreen</h1>
			<p className="lede">
				Exporting doesn't take a screenshot of the editor. It draws the document
				again, offscreen, at full size, with the same scene the canvas uses, and
				encodes the result. The button below runs the app's own{" "}
				<code>renderDocument</code> and <code>encodeImage</code>, here in your
				browser.
			</p>

			<div className="playground">
				<div className="playground-main">
					<div className="pair">
						<figure className="panel stage-panel">
							<SkiaStage width={document.width} height={document.height}>
								<DocumentRenderScene
									document={document}
									images={sample.images}
								/>
							</SkiaStage>
							<figcaption>
								<strong>The canvas.</strong> {document.width} ×{" "}
								{document.height}, drawn live.
							</figcaption>
						</figure>
						<figure className="panel stage-panel">
							{last ? (
								<img
									className="exported"
									src={last.url}
									alt={`The exported ${exportFormats[last.format].label}`}
								/>
							) : (
								<div className="stored-empty">Nothing exported yet.</div>
							)}
							<figcaption>
								<strong>The file.</strong>{" "}
								{last
									? `${exportFormats[last.format].label}, ${last.width} × ${last.height}, ${kilobytes(last.bytes)}, in ${Math.round(last.milliseconds)} ms.`
									: "An exported image appears here."}
							</figcaption>
						</figure>
					</div>

					<section className="panel export-list" aria-label="Exports">
						<h2>Exports</h2>
						<table>
							<thead>
								<tr>
									<th scope="col">Format</th>
									<th scope="col">Size</th>
									<th scope="col">File</th>
									<th scope="col">Took</th>
									<th scope="col">Same pixels as</th>
								</tr>
							</thead>
							<tbody>
								{exports.map((exported) => (
									<tr key={exported.url}>
										<td>{exportFormats[exported.format].label}</td>
										<td>
											{exported.width} × {exported.height}
										</td>
										<td>{kilobytes(exported.bytes)}</td>
										<td>{Math.round(exported.milliseconds)} ms</td>
										<td>
											{exportFormats[exported.other.format].label}:{" "}
											{kilobytes(exported.other.bytes)}
										</td>
									</tr>
								))}
								{exports.length === 0 && (
									<tr>
										<td colSpan={5} className="hint">
											None yet.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</section>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow steps={steps} state={{ exports }} />
					</section>
					<section className="panel controls" aria-label="Export">
						<h2>Export</h2>
						<h3 className="controls-heading">
							<code>exportSizes</code>
						</h3>
						<div className="choice-row">
							{sizes.map((option, index) => (
								<button
									key={option.scale}
									type="button"
									className={chosen === option ? "chip chosen" : "chip"}
									aria-pressed={chosen === option}
									onClick={() => setSize(index)}
								>
									{option.width} × {option.height}
								</button>
							))}
						</div>
						<h3 className="controls-heading">The document</h3>
						<label className="toggle">
							<input
								type="checkbox"
								checked={photo?.hidden ?? false}
								onChange={(event) => {
									const hidden = event.target.checked;
									setDocument((current) =>
										current
											? {
													...current,
													layers: current.layers.map((layer) =>
														layer.id === "photo" ? { ...layer, hidden } : layer,
													),
												}
											: current,
									);
								}}
							/>
							Hide the photo
						</label>
						<div className="choice-row">
							{backgrounds.map(({ label, value }) => (
								<button
									key={label}
									type="button"
									className={
										document.background === value ? "chip chosen" : "chip"
									}
									aria-pressed={document.background === value}
									onClick={() =>
										setDocument((current) =>
											current ? { ...current, background: value } : current,
										)
									}
								>
									{label}
								</button>
							))}
						</div>
						<p className="hint">
							<code>hasTransparency</code> {String(hasTransparency(document))} ·{" "}
							<code>exportFormatFor</code> {exportFormats[format].label}
						</p>
						<div className="presets">
							<button
								type="button"
								className="button-small primary"
								disabled={busy}
								onClick={exportNow}
							>
								{busy ? "Exporting…" : `Export ${exportFormats[format].label}`}
							</button>
						</div>
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					The export pipeline: <code>src/render/</code> draws, and the export
					screen picks the size and format.
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
						<h3>One scene, two surfaces</h3>
						<p>
							The editor's canvas and export draw the same layer views, so the
							file always matches the screen. Export just leaves out the
							selection and gestures.
						</p>
					</div>
					<div className="card">
						<h3>One decoded copy per file</h3>
						<p>
							Images come from the shared <code>decodedImages</code> cache.
							Export borrows the copy the editor already holds, and lets go of
							it as soon as it's done: camera photos are large.
						</p>
					</div>
					<div className="card">
						<h3>Full resolution, always</h3>
						<p>
							The document is drawn at its own pixel size, not the screen's. A
							4000-pixel photo exports at 4000 pixels, with every layer drawn
							for that size.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
