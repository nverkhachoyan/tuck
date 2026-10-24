import type { Layer } from "@model/document.ts";
import {
	type EditorSlice,
	MAX_HISTORY,
	selectCanRedo,
	selectCanUndo,
	selectSelectedLayer,
} from "@src/store/editorSlice.ts";
import { useState } from "react";
import { useStore } from "zustand";
import { SourceView } from "../../source/SourceView.tsx";
import type { SourceFile } from "../../source/sources.ts";
import { Flow, type FlowStep } from "../../ui/Flow.tsx";
import { HistoryTimeline } from "./HistoryTimeline.tsx";
import {
	type ActionRecord,
	createLessonStore,
	historyEffect,
} from "./lessonStore.ts";

type Progress = {
	state: EditorSlice;
	log: ActionRecord[];
};

function layerLabel(layer: Layer): string {
	switch (layer.type) {
		case "image":
			return layer.id === "photo" ? "The photo" : "Image";
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

const captions = ["Golden hour", "Out of office", "Weekend mode"];

export function HistoryLesson() {
	const [log, setLog] = useState<ActionRecord[]>([]);
	const [store, setStore] = useState(() =>
		createLessonStore((record) => setLog((previous) => [record, ...previous])),
	);
	const [run, setRun] = useState(0);
	const [tabName, setTabName] = useState("setDocument");
	const state = useStore(store);
	const { document, selectedLayerId } = state;
	if (!document) return null;
	const selected = selectSelectedLayer(state);
	const actions = store.getState();
	const count = (type: Layer["type"]) =>
		document.layers.filter((layer) => layer.type === type).length;

	const startOver = () => {
		setLog([]);
		setStore(
			createLessonStore((record) =>
				setLog((previous) => [record, ...previous]),
			),
		);
		setRun((value) => value + 1);
	};

	const steps: FlowStep<Progress>[] = [
		{
			title: "Add a layer",
			body: (
				<p>
					Add text, a shape, or a redaction. Each action builds the layer with
					the model and hands it to <code>setDocument</code>, which pushes the
					document and selection as they were onto <code>past</code>, and clears{" "}
					<code>future</code>. The new layer is selected.
				</p>
			),
			done: ({ state }) => state.past.length > 0,
		},
		{
			title: "Select another layer",
			body: (
				<p>
					Choose a different layer in the list. <code>selectLayer</code> changes{" "}
					<code>selectedLayerId</code> and nothing else: choosing isn't an edit,
					so there's no undo step. Each snapshot still remembers what was
					selected.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						record.action === "editor/selectLayer" &&
						record.after.selectedLayerId !== null,
				),
		},
		{
			title: "Nudge it a few times",
			body: (
				<p>
					Nudge the selected layer three times. The first nudge is a new step,
					and the rest join it: <code>nudgeLayer</code> remembers the document
					its last nudge made, and while that's still the current one, it
					replaces the document without touching <code>past</code>. Holding an
					arrow key is one undo step.
				</p>
			),
			done: ({ log }) =>
				log.filter((record) => historyEffect(record) === "joined the last step")
					.length >= 2,
		},
		{
			title: "Undo twice",
			body: (
				<p>
					Undo two steps. Each takes the last snapshot off <code>past</code> and
					puts the current one at the front of <code>future</code>. The
					selection comes back with the document.
				</p>
			),
			done: ({ log }) =>
				log.filter((record) => record.action === "editor/undo").length >= 2,
		},
		{
			title: "Edit after undoing",
			body: (
				<p>
					With something in <code>future</code>, make any edit. The redo steps
					are dropped: history doesn't branch, so a new edit after undoing
					starts a new line.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						record.before.future.length > 0 &&
						record.after.future.length === 0 &&
						record.action !== "editor/redo",
				),
		},
		{
			title: "Hide the selected layer",
			body: (
				<p>
					A hidden layer can't be selected, so hiding the selection clears it in
					the same step. Undo, and it comes back visible and selected.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						record.action === "editor/hideLayer" &&
						record.before.selectedLayerId !== null &&
						record.after.selectedLayerId === null,
				),
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "setDocument",
			file: "src/store/editorSlice.ts",
			name: "setDocument",
		},
		{ label: "addOnTop", file: "src/store/editorSlice.ts", name: "addOnTop" },
		{
			label: "selectLayer",
			file: "src/store/editorSlice.ts",
			name: "selectLayer",
		},
		{
			label: "nudgeLayer",
			file: "src/store/editorSlice.ts",
			name: "nudgeLayer",
		},
		{ label: "undo", file: "src/store/editorSlice.ts", name: "undo" },
		{ label: "redo", file: "src/store/editorSlice.ts", name: "redo" },
		{
			label: "selectionAfter",
			file: "src/store/editorSlice.ts",
			name: "selectionAfter",
		},
		{
			label: "EditorSnapshot",
			file: "src/store/editorSlice.ts",
			name: "EditorSnapshot",
		},
		{ label: "useStore", file: "src/store/index.ts", name: "useStore" },
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];
	const topFirst = [...document.layers].reverse();

	return (
		<article className="lesson">
			<p className="eyebrow">The store · Lesson 1</p>
			<h1>Every edit is a snapshot</h1>
			<p className="lede">
				The editor's state lives in one Zustand store, <code>useStore</code>,
				made from slices; today there's one, the editor slice. Every edit
				replaces the document with a new one and keeps the old one in{" "}
				<code>past</code>. Undo is just putting it back. The buttons below call
				the app's real slice.
			</p>

			<div className="playground">
				<div className="playground-main">
					<section className="panel" aria-label="History">
						<h2>History</h2>
						<HistoryTimeline state={state} />
						<p className="hint">
							Each picture is a snapshot: a document and what was selected in
							it. At most {MAX_HISTORY} are kept; older ones are dropped.
						</p>
					</section>

					<div className="pair">
						<section className="panel layers-panel" aria-label="Actions">
							<h2>Actions</h2>
							<div className="adders">
								<button
									type="button"
									className="button-small"
									onClick={() =>
										actions.addTextLayer(
											captions[count("text") % captions.length],
										)
									}
								>
									addTextLayer
								</button>
								<button
									type="button"
									className="button-small"
									onClick={() =>
										actions.addShape(
											"rectangle",
											{
												x: 800 + count("shape") * 40,
												y: 300 + count("shape") * 40,
												rotation: 0,
												width: 300,
												height: 200,
											},
											{ color: "#FF3B30", strokeWidth: 14 },
										)
									}
								>
									addShape
								</button>
								<button
									type="button"
									className="button-small"
									onClick={() =>
										actions.addRedactionBox(
											{
												x: 110 + count("redaction") * 40,
												y: 120 + count("redaction") * 40,
												width: 260,
												height: 200,
											},
											{ type: "blur", radius: 22 },
										)
									}
								>
									addRedactionBox
								</button>
							</div>
							<div className="adders">
								<button
									type="button"
									className="button-small"
									disabled={!selected || selected.locked}
									onClick={() =>
										selectedLayerId &&
										actions.nudgeLayer(selectedLayerId, 40, 0)
									}
								>
									nudgeLayer →
								</button>
								<button
									type="button"
									className="button-small"
									disabled={!selected}
									onClick={() =>
										selectedLayerId &&
										actions.setLayerHidden(selectedLayerId, true)
									}
								>
									hide it
								</button>
								<button
									type="button"
									className="button-small"
									disabled={!selected}
									onClick={() =>
										selectedLayerId && actions.deleteLayer(selectedLayerId)
									}
								>
									deleteLayer
								</button>
							</div>
							<div className="adders">
								<button
									type="button"
									className="button-small"
									disabled={!selectCanUndo(state)}
									onClick={actions.undo}
								>
									undo
								</button>
								<button
									type="button"
									className="button-small"
									disabled={!selectCanRedo(state)}
									onClick={actions.redo}
								>
									redo
								</button>
								<button
									type="button"
									className="button-small"
									onClick={startOver}
								>
									Start over
								</button>
							</div>
							<p className="list-note">
								Layers, top first. Choosing one calls <code>selectLayer</code>.
							</p>
							<ol className="layer-list">
								{topFirst.map((layer) => {
									const chosen = layer.id === selectedLayerId;
									return (
										<li
											key={layer.id}
											className={chosen ? "chosen" : undefined}
										>
											<button
												type="button"
												className="layer-name"
												aria-pressed={chosen}
												onClick={() => actions.selectLayer(layer.id)}
											>
												<span className={layer.hidden ? "faded" : undefined}>
													{layerLabel(layer)}
												</span>
												<small>
													{layer.hidden
														? "hidden"
														: layer.locked
															? "locked"
															: layer.type}
												</small>
											</button>
											{layer.hidden && (
												<button
													type="button"
													className="icon-button"
													onClick={() =>
														actions.setLayerHidden(layer.id, false)
													}
												>
													Show
												</button>
											)}
										</li>
									);
								})}
							</ol>
						</section>

						<section className="panel history" aria-label="Action log">
							<h2>Action log</h2>
							<p className="history-counts">
								As Redux DevTools names them. <code>selectedLayerId</code>:{" "}
								{selectedLayerId ?? "null"}
							</p>
							<ol className="log">
								{log.slice(0, 10).map((record) => {
									const effect = historyEffect(record);
									return (
										<li
											key={record.id}
											className={
												effect === "new undo step" ||
												effect === "squashed into one step"
													? "recorded"
													: "skipped"
											}
										>
											<code>{record.action}</code>
											<span />
											<small>{effect}</small>
										</li>
									);
								})}
								{log.length === 0 && (
									<li className="skipped">
										<small>No actions yet.</small>
									</li>
								)}
							</ol>
						</section>
					</div>
				</div>

				<aside className="playground-side">
					<section className="panel">
						<h2>Try this</h2>
						<Flow key={run} steps={steps} state={{ state, log }} />
					</section>
				</aside>
			</div>

			<section className="read-the-code">
				<h2>Read the code</h2>
				<p>
					The store's history in <code>src/store/editorSlice.ts</code>, and the
					one place it's combined into <code>useStore</code>.
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
						<h3>Undo is just a list</h3>
						<p>
							There are no inverse operations to write. Because model functions
							never change a document in place, keeping the old one is enough,
							and it shares every layer the edit didn't touch.
						</p>
					</div>
					<div className="card">
						<h3>Actions take ids, not layers</h3>
						<p>
							<code>transformLayer</code>, <code>setAdjustments</code>, and the
							rest look the layer up by id when they run. A gesture can end just
							as the selection moves on, and its result still belongs to the
							layer it started on.
						</p>
					</div>
					<div className="card">
						<h3>Only shared state goes here</h3>
						<p>
							The store holds what several screens share: the open document, its
							selection, and history. A panel's own state stays in{" "}
							<code>useState</code>, and components select the narrowest value
							they need, so an edit re-renders only what reads it.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
