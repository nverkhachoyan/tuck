import type { ReactNode } from "react";
import { extractDeclaration } from "./extract.ts";
import { type SourceFile, sources } from "./sources.ts";

const TOKEN =
	/(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(export|function|const|let|return|if|else|type|import|from|for|of|switch|case|default|new|typeof|as|in|true|false|null|undefined)\b|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)/gm;

function highlight(line: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let last = 0;
	for (const match of line.matchAll(TOKEN)) {
		const index = match.index ?? 0;
		if (index > last) parts.push(line.slice(last, index));
		const [text, comment, string, keyword, number] = match;
		const kind = comment
			? "comment"
			: string
				? "string"
				: keyword
					? "keyword"
					: number && "number";
		parts.push(
			<span key={index} className={`tok-${kind}`}>
				{text}
			</span>,
		);
		last = index + text.length;
	}
	if (last < line.length) parts.push(line.slice(last));
	return parts;
}

/**
 * A declaration from the app, read from the file as it is now.
 * Lines containing `focus` are marked, so a lesson can point at a step.
 */
export function SourceView({
	file,
	name,
	focus,
}: {
	file: SourceFile;
	name: string;
	focus?: string | null;
}) {
	const excerpt = extractDeclaration(sources[file], name);
	if (!excerpt) {
		return (
			<div className="source source-missing">
				<code>{name}</code> is no longer in <code>{file}</code>. The code this
				lesson explains has moved: update the lesson.
			</div>
		);
	}
	// Tabs as two spaces: a tab stop would count the line number's width too.
	const lines = excerpt.code.replaceAll("\t", "  ").split("\n");
	// A block comment's middle lines hold no code for the tokenizer to find.
	let inComment = false;
	return (
		<figure className="source">
			<figcaption>
				{file}:{excerpt.firstLine}
			</figcaption>
			<pre>
				{lines.map((line, index) => {
					const number = excerpt.firstLine + index;
					const focused = focus != null && line.includes(focus);
					const commentLine =
						inComment || (line.includes("/*") && !line.includes("*/"));
					if (line.includes("/*")) inComment = !line.includes("*/");
					else if (line.includes("*/")) inComment = false;
					return (
						<span key={number} className={focused ? "line focused" : "line"}>
							<span className="line-number">{number}</span>
							{commentLine ? (
								<span className="tok-comment">{line}</span>
							) : (
								highlight(line)
							)}
							{"\n"}
						</span>
					);
				})}
			</pre>
		</figure>
	);
}
