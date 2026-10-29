import { chapters } from "../lessons.ts";

const layers = [
	{ folder: "app", role: "Routes: each file registers a screen" },
	{ folder: "screens", role: "Home, create, the editor's route, export" },
	{ folder: "photos · projects", role: "Import and saving" },
	{
		folder: "editor · its store · render",
		role: "The editor and its tools, shared state, drawing",
	},
	{
		folder: "editor/document · editor/layers",
		role: "The document and its layers as plain data, and their geometry",
	},
];

export function Welcome() {
	const first = chapters[0];
	return (
		<article className="lesson welcome">
			<p className="eyebrow">A hands-on tour of the codebase</p>
			<h1>Inside Tuck</h1>
			<p className="lede">
				Each lesson pairs a short explanation with something to play with,
				running the app's real code. Code excerpts are read from the source as
				it is today, and lessons import the functions they explain, so a lesson
				can't quietly drift: rename what it covers and the docs fail to
				type-check, or the lesson says the code has moved.
			</p>

			<h2>Read from the bottom up</h2>
			<p>
				Imports in Tuck flow one way, from routes down to the document. Reading
				in the other direction means every file you open only uses things you've
				already seen.
			</p>
			<ol className="layer-stack">
				{layers.map((layer, index) => (
					<li
						key={layer.folder}
						className={index === layers.length - 1 ? "start" : undefined}
					>
						<code>src/{layer.folder}</code>
						<span>{layer.role}</span>
						{index === layers.length - 1 && (
							<strong className="start-here">Start here</strong>
						)}
					</li>
				))}
			</ol>

			<a
				className="button-primary"
				href={`#/${first.id}/${first.lessons[0].id}`}
			>
				Begin with {first.lessons[0].title.toLowerCase()}
			</a>
		</article>
	);
}
