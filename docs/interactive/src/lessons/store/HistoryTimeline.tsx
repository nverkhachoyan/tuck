import type { EditorSlice, EditorSnapshot } from "@src/store/editorSlice.ts";
import { DocumentScene, Selection } from "../model/layerViews.tsx";

// Past steps shown before they're summed up as "and N more".
const SHOWN = 6;

function Thumbnail({
	snapshot,
	label,
	marks,
	current,
}: {
	snapshot: EditorSnapshot;
	label: string;
	marks: string[];
	current?: boolean;
}) {
	const { document, selectedLayerId } = snapshot;
	const selected = document.layers.find(
		(layer) => layer.id === selectedLayerId,
	);
	return (
		<li className={current ? "snapshot current" : "snapshot"}>
			<svg
				viewBox={`-30 -30 ${document.width + 60} ${document.height + 60}`}
				role="img"
				aria-label={`${label}: ${document.layers.length} layers`}
			>
				<DocumentScene document={document} />
				{selected && !selected.hidden && <Selection layer={selected} />}
			</svg>
			<span className="snapshot-label">{label}</span>
			{marks.map((mark) => (
				<span key={mark} className="snapshot-mark">
					{mark}
				</span>
			))}
		</li>
	);
}

/**
 * The store's history as pictures: `past` oldest first, the document now,
 * and `future` in the order redo brings it back. A tool's session marks the
 * step it started from and the redo step it stops at.
 */
export function HistoryTimeline({ state }: { state: EditorSlice }) {
	const { past, future, session, document, selectedLayerId } = state;
	if (!document) return null;
	const marks = (snapshot: EditorSnapshot) => {
		const result: string[] = [];
		if (session && snapshot.document === session.document) {
			result.push("tool opened here");
		}
		if (session?.redoStop === snapshot) result.push("redo stops here");
		return result;
	};
	const hidden = Math.max(0, past.length - SHOWN);
	const now = { document, selectedLayerId };
	return (
		<div className="timeline">
			<section aria-label="past">
				<h3>
					<code>past</code> {past.length}
				</h3>
				<ol>
					{hidden > 0 && <li className="snapshot more">+{hidden} older</li>}
					{past.slice(hidden).map((snapshot, index) => (
						<Thumbnail
							// biome-ignore lint/suspicious/noArrayIndexKey: positions in the list are what it shows.
							key={hidden + index}
							snapshot={snapshot}
							label={`past[${hidden + index}]`}
							marks={marks(snapshot)}
						/>
					))}
					{past.length === 0 && <li className="snapshot empty">empty</li>}
				</ol>
			</section>
			<section aria-label="now">
				<h3>now</h3>
				<ol>
					<Thumbnail
						snapshot={now}
						label="document"
						marks={marks(now)}
						current
					/>
				</ol>
			</section>
			<section aria-label="future">
				<h3>
					<code>future</code> {future.length}
				</h3>
				<ol>
					{future.slice(0, SHOWN).map((snapshot, index) => (
						<Thumbnail
							// biome-ignore lint/suspicious/noArrayIndexKey: positions in the list are what it shows.
							key={index}
							snapshot={snapshot}
							label={`future[${index}]`}
							marks={marks(snapshot)}
						/>
					))}
					{future.length > SHOWN && (
						<li className="snapshot more">+{future.length - SHOWN} more</li>
					)}
					{future.length === 0 && <li className="snapshot empty">empty</li>}
				</ol>
			</section>
		</div>
	);
}
