import type { RedactionEffect } from "@src/editor/layers/redaction/redaction.ts";
import {
	type EditorSlice,
	selectCanRedo,
	selectCanUndo,
	selectSelectedRedaction,
} from "@src/editor/store/editorSlice.ts";
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

type Progress = { state: EditorSlice; log: ActionRecord[] };

const effects: { label: string; effect: RedactionEffect }[] = [
	{ label: "Blur", effect: { type: "blur", radius: 22 } },
	{ label: "Black", effect: { type: "solid", color: "#111111" } },
];

const inSession = (record: ActionRecord) => record.before.session !== null;

export function SessionsLesson() {
	const [log, setLog] = useState<ActionRecord[]>([]);
	const report = (record: ActionRecord) =>
		setLog((previous) => [record, ...previous]);
	const [store, setStore] = useState(() => createLessonStore(report));
	const [run, setRun] = useState(0);
	const [tabName, setTabName] = useState("beginSession");
	const state = useStore(store);
	const { document, session, selectedLayerId } = state;
	if (!document) return null;
	const actions = store.getState().actions;
	const redaction = selectSelectedRedaction(state);
	const redactions = document.layers.filter(
		(layer) => layer.type === "redaction",
	).length;
	const canUndo = selectCanUndo(state);
	const canRedo = selectCanRedo(state);

	const startOver = () => {
		setLog([]);
		setStore(createLessonStore(report));
		setRun((value) => value + 1);
	};

	const steps: FlowStep<Progress>[] = [
		{
			title: "Edit before the tool",
			body: (
				<p>
					Add text or a shape with the tool closed. That's an ordinary undo
					step, from before the tool, which the tool must never undo.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						!inSession(record) && historyEffect(record) === "new undo step",
				),
		},
		{
			title: "Open the Redact tool",
			body: (
				<p>
					Opening a tool calls <code>beginSession</code>. It records where the
					tool started, the document and selection then, and the redo step that
					was next, as the store's <code>session</code>. Nothing else changes.
				</p>
			),
			done: ({ log }) =>
				log.some((record) => record.action === "editor/beginSession"),
		},
		{
			title: "Make three changes",
			body: (
				<p>
					Add redactions and switch their effect. Each is an ordinary undo step
					while the tool is open, so you can step back and forth inside it.
				</p>
			),
			done: ({ log }) =>
				log.filter(
					(record) =>
						inSession(record) && historyEffect(record) === "new undo step",
				).length >= 3,
		},
		{
			title: "Undo back to the start",
			body: (
				<p>
					Undo until the button stops. It stops where the tool opened, though{" "}
					<code>past</code> still holds your edit from before:{" "}
					<code>selectCanUndo</code> says no once the document is the session's
					own. Cancel is the way back past it.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						record.action === "editor/undo" &&
						record.after.session !== null &&
						record.after.document === record.after.session.document,
				),
		},
		{
			title: "Redo, then Done",
			body: (
				<p>
					Redo a change or two, or make new ones, then press{" "}
					<strong>Done</strong>. <code>commitSession</code> drops the tool's
					steps from <code>past</code> and keeps one: the document from where
					the tool started. The whole tool is now one undo step.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) => historyEffect(record) === "squashed into one step",
				),
		},
		{
			title: "Open it again, and Cancel",
			body: (
				<p>
					Open the tool, change something, and press <strong>Cancel</strong>.{" "}
					<code>cancelSession</code> returns to where it started, and puts what
					you'd done at the front of <code>future</code>.
				</p>
			),
			done: ({ log }) =>
				log.some(
					(record) =>
						historyEffect(record) === "back to where the tool started",
				),
		},
		{
			title: "Redo the cancel",
			body: (
				<p>
					Press redo: the canceled changes come back, all at once. A cancel is
					undoable like anything else.
				</p>
			),
			done: ({ log }) => {
				const cancel = log.find(
					(record) =>
						historyEffect(record) === "back to where the tool started",
				);
				return (
					cancel !== undefined &&
					log.some(
						(record) =>
							record.action === "editor/redo" &&
							record.id > cancel.id &&
							record.after.session === null,
					)
				);
			},
		},
	];

	const tabs: { label: string; file: SourceFile; name: string }[] = [
		{
			label: "beginSession",
			file: "src/editor/store/editorSlice.ts",
			name: "beginSession",
		},
		{
			label: "commitSession",
			file: "src/editor/store/editorSlice.ts",
			name: "commitSession",
		},
		{
			label: "cancelSession",
			file: "src/editor/store/editorSlice.ts",
			name: "cancelSession",
		},
		{
			label: "pastBefore",
			file: "src/editor/store/editorSlice.ts",
			name: "pastBefore",
		},
		{
			label: "selectCanUndo",
			file: "src/editor/store/editorSlice.ts",
			name: "selectCanUndo",
		},
		{
			label: "selectCanRedo",
			file: "src/editor/store/editorSlice.ts",
			name: "selectCanRedo",
		},
		{
			label: "EditorSession",
			file: "src/editor/store/editorSlice.ts",
			name: "EditorSession",
		},
	];
	const tab = tabs.find((candidate) => candidate.label === tabName) ?? tabs[0];

	return (
		<article className="lesson">
			<p className="eyebrow">The store · Lesson 2</p>
			<h1>A tool is one undo step</h1>
			<p className="lede">
				While a tool is open, every change it makes is an undo step of its own,
				so you can step back and forth inside it. When it closes, Done turns all
				of them into one step, and Cancel returns to where it started. The store
				does this with a <code>session</code>: a note of where the tool began.
			</p>

			<div className="playground">
				<div className="playground-main">
					<section className="panel" aria-label="History">
						<h2>History</h2>
						<HistoryTimeline state={state} />
						<p className="hint">
							<code>session</code>:{" "}
							{session
								? "open. The snapshot marked “tool opened here” is where it began."
								: "null, no tool is open."}
						</p>
					</section>

					<div className="pair">
						<section className="panel layers-panel" aria-label="Actions">
							<h2>Outside the tool</h2>
							<div className="adders">
								<button
									type="button"
									className="button-small"
									disabled={session !== null}
									onClick={() => actions.addTextLayer("Golden hour")}
								>
									addTextLayer
								</button>
								<button
									type="button"
									className="button-small"
									disabled={session !== null}
									onClick={() =>
										actions.addShape(
											"arrow",
											{ x: 760, y: 250, rotation: 0.76, width: 300, height: 0 },
											{ color: "#FF3B30", strokeWidth: 14 },
										)
									}
								>
									addShape
								</button>
							</div>

							<h2 className="tool-heading">
								The Redact tool{" "}
								<span className={session ? "tool-state open" : "tool-state"}>
									{session ? "open" : "closed"}
								</span>
							</h2>
							{session ? (
								<>
									<div className="adders">
										<button
											type="button"
											className="button-small"
											onClick={() =>
												actions.addRedactionBox(
													{
														x: 90 + (redactions % 4) * 260,
														y: 110 + Math.floor(redactions / 4) * 200,
														width: 230,
														height: 170,
													},
													effects[0].effect,
												)
											}
										>
											addRedactionBox
										</button>
										{effects.map(({ label, effect }) => (
											<button
												key={label}
												type="button"
												className="button-small"
												disabled={!redaction}
												onClick={() =>
													selectedLayerId &&
													actions.setRedactionEffect(selectedLayerId, effect)
												}
											>
												{label}
											</button>
										))}
									</div>
									<div className="adders">
										<button
											type="button"
											className="button-small primary"
											onClick={actions.commitSession}
										>
											Done
										</button>
										<button
											type="button"
											className="button-small"
											onClick={actions.cancelSession}
										>
											Cancel
										</button>
									</div>
								</>
							) : (
								<div className="adders">
									<button
										type="button"
										className="button-small"
										onClick={actions.beginSession}
									>
										Open the tool
									</button>
								</div>
							)}

							<h2 className="tool-heading">History</h2>
							<div className="adders">
								<button
									type="button"
									className="button-small"
									disabled={!canUndo}
									onClick={actions.undo}
								>
									undo
								</button>
								<button
									type="button"
									className="button-small"
									disabled={!canRedo}
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
							<p className="hint">
								<code>selectCanUndo</code> {String(canUndo)} ·{" "}
								<code>selectCanRedo</code> {String(canRedo)}
								{session &&
									!canUndo &&
									state.past.length > 0 &&
									" · undo stops where the tool opened"}
							</p>
						</section>

						<section className="panel history" aria-label="Action log">
							<h2>Action log</h2>
							<ol className="log">
								{log.slice(0, 12).map((record) => {
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
											<small>
												{effect}
												{inSession(record) &&
													record.action !== "editor/commitSession" &&
													record.action !== "editor/cancelSession" &&
													" · in the tool"}
											</small>
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
					Sessions in <code>src/editor/store/editorSlice.ts</code>. Every check
					is an identity check on snapshots, as in the model chapter.
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
						<h3>A session is two pointers</h3>
						<p>
							The store doesn't copy anything to open a tool. It notes the
							snapshot it started from and the redo step that was next, and
							later finds them again with <code>===</code>.
						</p>
					</div>
					<div className="card">
						<h3>Inside a tool, history stays inside</h3>
						<p>
							Undo can't step back past where the tool opened, and redo can't
							step into what was undone before it. A tool only ever moves
							through its own changes.
						</p>
					</div>
					<div className="card">
						<h3>Cancel is undoable</h3>
						<p>
							Cancel is undo for a whole tool, so it leaves the tool's work
							where redo can find it: one press brings it all back as a single
							step.
						</p>
					</div>
				</div>
			</section>
		</article>
	);
}
