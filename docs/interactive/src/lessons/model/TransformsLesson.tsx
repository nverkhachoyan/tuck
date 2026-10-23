import {
	cosSin,
	hitTestBox,
	type Point,
	type Transform,
	toDocumentSpace,
	toLayerSpace,
} from "@model/geometry.ts";
import { type ReactNode, useState } from "react";
import { SourceView } from "../../source/SourceView.tsx";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { format } from "../../ui/format.ts";
import {
	DOCUMENT,
	DocumentStage,
	IMAGE,
	IMAGE_BOX,
	LayerSpaceView,
} from "./TransformStage.tsx";

type Playground = {
	transform: Transform;
	probe: Point;
	probed: boolean;
};

const START: Playground = {
	transform: {
		x: DOCUMENT.width / 2,
		y: DOCUMENT.height / 2,
		scaleX: 1,
		scaleY: 1,
		rotation: 0,
	},
	probe: { x: 940, y: 220 },
	probed: false,
};

const QUARTER = Math.PI / 2;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => Math.round((radians * 180) / Math.PI);

function isQuarterTurn(rotation: number): boolean {
	const quarters = rotation / QUARTER;
	return (
		Math.abs(quarters - Math.round(quarters)) < 1e-12 &&
		Math.round(quarters) % 4 !== 0
	);
}

const presets: { label: string; state: Playground }[] = [
	{ label: "Start over", state: START },
	{
		label: "The worked example",
		state: {
			transform: { x: 600, y: 450, scaleX: 2, scaleY: 2, rotation: QUARTER },
			probe: { x: 600, y: 650 },
			probed: true,
		},
	},
	{
		label: "Stretched, then turned",
		state: {
			transform: {
				x: 560,
				y: 430,
				scaleX: 1.8,
				scaleY: 0.7,
				rotation: toRadians(30),
			},
			probe: { x: 780, y: 560 },
			probed: true,
		},
	},
];

// Which excerpt a computation row points at, and the line it's on.
type Focus = { name: SourceName; line: string };
type SourceName =
	| "toLayerSpace"
	| "hitTestBox"
	| "cosSin"
	| "toDocumentSpace"
	| "transformMatrix";
const sourceNames: SourceName[] = [
	"toLayerSpace",
	"hitTestBox",
	"cosSin",
	"toDocumentSpace",
	"transformMatrix",
];

function Slider({
	label,
	value,
	min,
	max,
	step,
	shown,
	onChange,
}: {
	label: ReactNode;
	value: number;
	min: number;
	max: number;
	step: number;
	shown: string;
	onChange: (value: number) => void;
}) {
	return (
		<label className="slider">
			<span className="slider-label">{label}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
			<output>{shown}</output>
		</label>
	);
}

export function TransformsLesson() {
	const [state, setState] = useState<Playground>(START);
	const [focus, setFocus] = useState<Focus | null>(null);
	const [tab, setTab] = useState<SourceName>("toLayerSpace");
	// Starting over clears the checklist too.
	const [run, setRun] = useState(0);

	const { transform, probe } = state;
	const local = toLayerSpace(transform, probe);
	const hit = hitTestBox(transform, IMAGE_BOX, probe);
	const { cos, sin } = cosSin(transform.rotation);
	const back = toDocumentSpace(transform, local);
	const dx = probe.x - transform.x;
	const dy = probe.y - transform.y;

	const setTransform = (patch: Partial<Transform>) =>
		setState((previous) => ({
			...previous,
			transform: { ...previous.transform, ...patch },
		}));
	const setProbe = (point: Point) =>
		setState((previous) => ({ ...previous, probe: point, probed: true }));

	const steps: FlowStep<Playground>[] = [
		{
			title: "Move the layer",
			body: (
				<p>
					Drag the black knob. It's <code>transform.x</code> and{" "}
					<code>transform.y</code>: the layer's <em>center</em> in document
					space, not its top-left corner. Every layer in Tuck is placed by its
					middle.
				</p>
			),
			done: (s) =>
				s.transform.x !== START.transform.x ||
				s.transform.y !== START.transform.y,
		},
		{
			title: "Turn it",
			body: (
				<p>
					Use the rotation slider. The layer turns around its center, and its
					own axes (<span className="swatch-x">+x</span>,{" "}
					<span className="swatch-y">+y</span>) turn with it. Rotation is in
					radians, and positive turns clockwise, because y points down.
				</p>
			),
			done: (s) => s.transform.rotation !== 0,
		},
		{
			title: "Stretch it",
			body: (
				<p>
					Give it different x and y scales while it's turned. It stretches along
					its <em>own</em> axes, not the screen's: scale is applied first, then
					rotation, then the move to the center.
				</p>
			),
			done: (s) => s.transform.scaleX !== s.transform.scaleY,
		},
		{
			title: "Probe a point",
			body: (
				<p>
					Click or drag anywhere on the canvas away from the knob. The smaller
					view shows the same point in layer space, where the layer's box is
					upright and unscaled again, worked out by <code>toLayerSpace</code>.
				</p>
			),
			done: (s) => s.probed,
		},
		{
			title: "Hit the turned layer",
			body: (
				<p>
					Put the probe inside the layer while it's turned. Testing a rotated,
					stretched box sounds hard, but <code>hitTestBox</code> moves the point
					into layer space, where the test is just two comparisons against the
					half sizes.
				</p>
			),
			done: (s) =>
				s.transform.rotation !== 0 &&
				hitTestBox(s.transform, IMAGE_BOX, s.probe),
		},
		{
			title: "Land on a quarter turn",
			body: (
				<p>
					Set the rotation to exactly 90°, −90°, or 180°. Then check the{" "}
					<code>cos, sin</code> row: <code>cosSin</code> gives exact zeros
					there, where <code>Math.cos</code> would give a tiny leftover. That
					way, turning a photo four times lands back where it started, and{" "}
					<code>transformsEqual</code>, which compares with <code>===</code>,
					agrees.
				</p>
			),
			done: (s) => isQuarterTurn(s.transform.rotation),
		},
	];

	const rows: {
		label: string;
		formula: string;
		value: ReactNode;
		focus: Focus;
	}[] = [
		{
			label: "dx",
			formula: "point.x − transform.x",
			value: `${format(probe.x)} − ${format(transform.x)} = ${format(dx)}`,
			focus: { name: "toLayerSpace", line: "const dx =" },
		},
		{
			label: "dy",
			formula: "point.y − transform.y",
			value: `${format(probe.y)} − ${format(transform.y)} = ${format(dy)}`,
			focus: { name: "toLayerSpace", line: "const dy =" },
		},
		{
			label: "cos, sin",
			formula: `cosSin(${toDegrees(transform.rotation)}°)`,
			value: (
				<>
					{format(cos)}, {format(sin)}
					{isQuarterTurn(transform.rotation) && (
						<span className="aside">
							Math.cos gives {format(Math.cos(transform.rotation))}
						</span>
					)}
				</>
			),
			focus: { name: "toLayerSpace", line: "cosSin(transform.rotation)" },
		},
		{
			label: "local x",
			formula: "(dx·cos + dy·sin) / scaleX",
			value: format(local.x),
			focus: { name: "toLayerSpace", line: "x: (dx * cos" },
		},
		{
			label: "local y",
			formula: "(dy·cos − dx·sin) / scaleY",
			value: format(local.y),
			focus: { name: "toLayerSpace", line: "y: (dy * cos" },
		},
		{
			label: "hit?",
			formula: `|x| ≤ ${IMAGE_BOX.halfWidth} and |y| ≤ ${IMAGE_BOX.halfHeight}`,
			value: (
				<strong className={hit ? "verdict hit" : "verdict"}>
					{hit ? "inside" : "outside"}
				</strong>
			),
			focus: { name: "hitTestBox", line: "Math.abs(local.x)" },
		},
		{
			label: "and back",
			formula: "toDocumentSpace(transform, local)",
			value: `${format(back.x)}, ${format(back.y)}`,
			focus: { name: "toDocumentSpace", line: "x: transform.x + x * cos" },
		},
	];

	const shownSource = focus?.name ?? tab;

	return (
		<article className="lesson">
			<p className="eyebrow">The model · Lesson 1</p>
			<h1>Two spaces and a transform</h1>
			<p className="lede">
				Everything in Tuck lives in one of two spaces.{" "}
				<strong>Document space</strong> is the canvas in its own pixels, with
				(0, 0) at the top left. <strong>Layer space</strong> belongs to one
				layer: its center is the origin, and its rotation and scale are undone.
				A <code>Transform</code>, five numbers, maps one onto the other.
			</p>

			<div className="playground">
				<div className="playground-main">
					<figure className="panel stage-panel">
						<DocumentStage
							transform={transform}
							probe={probe}
							hit={hit}
							onMove={(center) => setTransform(center)}
							onProbe={setProbe}
						/>
						<figcaption>
							<strong>Document space.</strong> A {IMAGE.width} × {IMAGE.height}{" "}
							image layer on a {DOCUMENT.width} × {DOCUMENT.height} canvas,
							drawn with the matrix from the model's own{" "}
							<code>transformMatrix</code>. Outside the canvas it's cropped, so
							that part shows faintly.
						</figcaption>
					</figure>

					<div className="pair">
						<figure className="panel">
							<LayerSpaceView local={local} hit={hit} />
							<figcaption>
								<strong>Layer space.</strong> The same probe, at{" "}
								<code>
									{format(local.x)}, {format(local.y)}
								</code>
								.
							</figcaption>
						</figure>

						<section
							className="panel computation"
							aria-label="toLayerSpace, step by step"
						>
							<h2>toLayerSpace, live</h2>
							<div className="rows">
								{rows.map((row) => (
									<button
										key={row.label}
										type="button"
										className={
											focus?.line === row.focus.line ? "row focused" : "row"
										}
										onClick={() => setTab(row.focus.name)}
										onPointerEnter={() => setFocus(row.focus)}
										onPointerLeave={() => setFocus(null)}
										onFocus={() => setFocus(row.focus)}
										onBlur={() => setFocus(null)}
									>
										<span className="label">{row.label}</span>
										<span className="value">{row.value}</span>
										<span className="formula">{row.formula}</span>
									</button>
								))}
							</div>
							<p className="hint">
								Point at a row to see its line of code below.
							</p>
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={state} />
					</section>

					<section className="panel controls" aria-label="Transform">
						<h2>
							<code>transform</code>
						</h2>
						<Slider
							label="x"
							value={transform.x}
							min={0}
							max={DOCUMENT.width}
							step={1}
							shown={format(transform.x)}
							onChange={(x) => setTransform({ x })}
						/>
						<Slider
							label="y"
							value={transform.y}
							min={0}
							max={DOCUMENT.height}
							step={1}
							shown={format(transform.y)}
							onChange={(y) => setTransform({ y })}
						/>
						<Slider
							label="rotation"
							value={toDegrees(transform.rotation)}
							min={-180}
							max={180}
							step={1}
							shown={`${toDegrees(transform.rotation)}° · ${format(transform.rotation)} rad`}
							onChange={(degrees) =>
								setTransform({ rotation: toRadians(degrees) })
							}
						/>
						<Slider
							label="scaleX"
							value={transform.scaleX}
							min={0.25}
							max={3}
							step={0.05}
							shown={format(transform.scaleX)}
							onChange={(scaleX) => setTransform({ scaleX })}
						/>
						<Slider
							label="scaleY"
							value={transform.scaleY}
							min={0.25}
							max={3}
							step={0.05}
							shown={format(transform.scaleY)}
							onChange={(scaleY) => setTransform({ scaleY })}
						/>
						<div className="probe-inputs">
							<span className="slider-label">probe</span>
							{(["x", "y"] as const).map((axis) => (
								<label key={axis}>
									{axis}
									<input
										type="number"
										value={probe[axis]}
										step={10}
										onChange={(event) =>
											setProbe({ ...probe, [axis]: Number(event.target.value) })
										}
									/>
								</label>
							))}
						</div>
						<div className="presets">
							{presets.map((preset) => (
								<button
									key={preset.label}
									type="button"
									className="button-small"
									onClick={() => {
										setState(preset.state);
										if (preset.state === START) setRun((value) => value + 1);
									}}
								>
									{preset.label}
								</button>
							))}
						</div>
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					These are the real functions from <code>src/model/geometry.ts</code>,
					read from the file as it is now. The playground above calls them
					directly.
				</p>
				<div className="tabs" role="tablist">
					{sourceNames.map((name) => (
						<button
							key={name}
							type="button"
							role="tab"
							aria-selected={shownSource === name}
							className={shownSource === name ? "tab chosen" : "tab"}
							onClick={() => setTab(name)}
						>
							{name}
						</button>
					))}
				</div>
				<SourceView
					file="src/model/geometry.ts"
					name={shownSource}
					focus={focus?.name === shownSource ? focus.line : null}
				/>
			</section>

			<section className="takeaways">
				<h2>Why it's built this way</h2>
				<div className="cards">
					<div className="card">
						<h3>Hit testing is two comparisons</h3>
						<p>
							Move the point into layer space and any layer, however it's turned
							or stretched, becomes an upright box around the origin. The
							editor's <code>canvas/hitTest.ts</code> does exactly this for
							every tap.
						</p>
					</div>
					<div className="card">
						<h3>Exact quarter turns</h3>
						<p>
							<code>cosSin</code> snaps to 0 and ±1 at quarter turns. Without
							it, four turns of the crop tool would leave a transform a hair
							off, and the project would think it had been edited.
						</p>
					</div>
					<div className="card">
						<h3>
							Those <code>"worklet"</code> strings
						</h3>
						<p>
							They let Reanimated run these functions on the UI thread during a
							gesture. To everything else they're just strings, so the model
							stays plain TypeScript, and these docs can run it in a browser.
						</p>
					</div>
				</div>
				<p className="where-used">
					<strong>Where it's used:</strong> rendering builds Skia's transform
					list from the same five numbers (<code>render/layerTransform.ts</code>
					), and the editor's gestures, selection handles, and detection results
					all convert through <code>toLayerSpace</code> and{" "}
					<code>toDocumentSpace</code>.
				</p>
			</section>
		</article>
	);
}
