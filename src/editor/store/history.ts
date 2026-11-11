import type { EditorDocument } from "../document/document.ts";
import type { Layer } from "../layers/layer.ts";

// Undo steps kept; the oldest are dropped beyond this.
export const MAX_HISTORY = 100;

export type EditorSnapshot = {
	document: EditorDocument;
	selectedLayerId: string | null;
};

/**
 * How many undo steps a tool's session leaves once it's done: one for the
 * whole session, one for each change (the Eraser's swipes), or one for each
 * mark (Pen's strokes, a shape or a redaction, see `stepsByMark`).
 */
export type ToolSessionSteps = "one" | "each" | "marks";

// While a tool is open, where it started, and the undo and redo steps that
// were next then. Undo stops at the start, and redo at that step, so a tool
// never steps into changes from before it opened. A tool that only
// `previews` its changes until Done leaves the app seeing where it started;
// `steps` is what its changes become when it's done.
export type ToolSession = EditorSnapshot & {
	undoStop: EditorSnapshot | undefined;
	redoStop: EditorSnapshot | undefined;
	previews: boolean;
	steps: ToolSessionSteps;
};

export function snapshotOf({
	document,
	selectedLayerId,
}: EditorSnapshot): EditorSnapshot {
	return { document, selectedLayerId };
}

/**
 * The undo steps `toolSession` took: those after the one that was last when it
 * started (or all of them, if it took so many that one was dropped).
 */
export function pastIn(
	past: EditorSnapshot[],
	{ undoStop }: ToolSession,
): EditorSnapshot[] {
	return undoStop ? past.slice(past.indexOf(undoStop) + 1) : past;
}

/**
 * The undo steps from before `toolSession`, up to the one that was last when it
 * started. Undo can't go past the start, so that step stays unless the
 * session took so many steps that everything before it was dropped.
 */
export function pastBefore(
	past: EditorSnapshot[],
	{ undoStop }: ToolSession,
): EditorSnapshot[] {
	return undoStop ? past.slice(0, past.indexOf(undoStop) + 1) : [];
}

/**
 * A session's undo `steps`, each the snapshot from before a change, kept one
 * per mark: a step whose change went to the same mark as the step before it
 * joins that step. A, A, B keeps two; A, B, A keeps three. `current` is the
 * snapshot after the last change.
 *
 * - A change's mark is the layer it added, changed, or removed, read from the
 *   documents, since a tap that selects or deselects between changes moves
 *   the selection without a step of its own.
 * - A change to several layers at once (a group hidden) is a mark of its
 *   own, joining neither neighbor.
 * - A change that touched no layer (a reorder) takes the selection after it.
 * - A mark that ends as it began (a shape drawn, then deleted) keeps no step.
 */
export function stepsByMark(
	steps: EditorSnapshot[],
	current: EditorSnapshot,
): EditorSnapshot[] {
	const markOf = (index: number) => {
		const after = index + 1 < steps.length ? steps[index + 1] : current;
		const changed = changedLayers(
			steps[index].document.layers,
			after.document.layers,
		);
		if (changed.length === 0) return after.selectedLayerId;
		return changed.length === 1 ? changed[0] : steps[index];
	};
	const runs: { step: EditorSnapshot; mark: ReturnType<typeof markOf> }[] = [];
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const mark = markOf(i);
		const last = runs.at(-1);
		if (
			last &&
			last.mark !== mark &&
			sameDocument(last.step.document, step.document)
		) {
			runs.pop();
		}
		if (runs.at(-1)?.mark !== mark) {
			runs.push({ step, mark });
		}
	}
	const last = runs.at(-1);
	if (last && sameDocument(last.step.document, current.document)) {
		runs.pop();
	}
	return runs.map(({ step }) => step);
}

// Whether two documents hold the same layers in the same order, groups, and
// canvas, though they may be different objects. Every layer edit rebuilds
// the groups, so they're compared by what they hold.
function sameDocument(a: EditorDocument, b: EditorDocument): boolean {
	return (
		a.width === b.width &&
		a.height === b.height &&
		a.background === b.background &&
		a.layers.length === b.layers.length &&
		a.layers.every((layer, index) => layer === b.layers[index]) &&
		JSON.stringify(a.groups ?? []) === JSON.stringify(b.groups ?? [])
	);
}

/** The ids of the layers added, changed, or removed from `before` to `after`. */
function changedLayers(
	before: readonly Layer[],
	after: readonly Layer[],
): string[] {
	const byId = new Map(before.map((layer) => [layer.id, layer]));
	const kept = new Set(after.map((layer) => layer.id));
	return [
		...after.filter((layer) => byId.get(layer.id) !== layer),
		...before.filter((layer) => !kept.has(layer.id)),
	].map((layer) => layer.id);
}
