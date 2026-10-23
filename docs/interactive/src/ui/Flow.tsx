import { type ReactNode, useEffect, useState } from "react";

export type FlowStep<State> = {
	title: string;
	body: ReactNode;
	// Whether the reader has done what the step asks, judged from the
	// lesson's live state.
	done: (state: State) => boolean;
};

/**
 * A lesson's steps as a checklist. A step stays checked once it's done, so
 * undoing an action later doesn't take the reader backwards; the current
 * step is the first unchecked one.
 */
export function Flow<State>({
	steps,
	state,
}: {
	steps: FlowStep<State>[];
	state: State;
}) {
	const [checked, setChecked] = useState<boolean[]>(() =>
		steps.map(() => false),
	);

	useEffect(() => {
		setChecked((previous) => {
			const next = previous.map(
				(was, index) => was || steps[index].done(state),
			);
			return next.every((value, index) => value === previous[index])
				? previous
				: next;
		});
	}, [steps, state]);

	const current = checked.indexOf(false);
	const complete = current < 0;
	// A step the reader opened to read again, until the next one comes up.
	const [opened, setOpened] = useState<{ index: number; while: number }>();
	const shown = opened?.while === current ? opened.index : current;

	return (
		<ol className="flow">
			{steps.map((step, index) => {
				const status = checked[index]
					? "done"
					: index === current
						? "current"
						: "upcoming";
				return (
					<li key={step.title} className={`flow-step ${status}`}>
						<span className="flow-marker" aria-hidden>
							{checked[index] ? "✓" : index + 1}
						</span>
						<div>
							<h3>
								<button
									type="button"
									className="flow-title"
									onClick={() =>
										setOpened({
											index: index === shown ? -1 : index,
											while: current,
										})
									}
								>
									{step.title}
								</button>
							</h3>
							{index === shown && <div className="flow-body">{step.body}</div>}
						</div>
					</li>
				);
			})}
			{complete && (
				<li className="flow-complete">
					All done. Keep playing, or move on to the next lesson.
				</li>
			)}
		</ol>
	);
}
