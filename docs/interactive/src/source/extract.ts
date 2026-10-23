/** A declaration lifted out of a source file, with the comment above it. */
export type Excerpt = {
	code: string;
	// 1-based, in the file it came from.
	firstLine: number;
};

// Strings and comments can hold braces that aren't code.
function stripNonCode(line: string): string {
	return line
		.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
		.replace(/\/\/.*$/, "");
}

function startsLeadingComment(lines: string[], index: number): number {
	let start = index;
	const above = lines[start - 1]?.trim();
	if (above?.endsWith("*/")) {
		while (start > 0 && !lines[start - 1].trim().startsWith("/*")) start -= 1;
		return start - 1;
	}
	while (start > 0 && lines[start - 1].trim().startsWith("//")) start -= 1;
	return start;
}

/**
 * The function, type, or constant named `name`, read from the file's
 * current text: a top-level declaration, or failing that one nested in a
 * function, or a method of an object (a store slice's actions). Null when
 * it's gone, which a lesson shows rather than hides: the code it explains
 * has moved.
 */
export function extractDeclaration(
	source: string,
	name: string,
): Excerpt | null {
	const lines = source.split("\n");
	const topLevel = new RegExp(
		`^(export )?(async )?(function|const|type|let) ${name}\\b`,
	);
	const nested = new RegExp(
		`^\\s+((async )?(function|const|let) ${name}\\b|${name}: )`,
	);
	let index = lines.findIndex((line) => topLevel.test(line));
	// The last nested match: a slice's type lists its actions before the
	// slice defines them.
	if (index < 0) index = lines.findLastIndex((line) => nested.test(line));
	if (index < 0) return null;
	// A method ends at its comma, as one of an object's entries.
	const isMethod = !/^\s*(export |async |function |const |let |type )/.test(
		lines[index],
	);

	// Brackets of every kind, so a parameter list's commas aren't an end.
	let depth = 0;
	let end = index;
	for (; end < lines.length; end += 1) {
		const code = stripNonCode(lines[end]);
		for (const char of code) {
			if ("{([".includes(char)) depth += 1;
			if ("})]".includes(char)) depth -= 1;
		}
		const trimmed = code.trimEnd();
		const closes =
			trimmed.endsWith("}") ||
			trimmed.endsWith(";") ||
			(isMethod && trimmed.endsWith(","));
		if (depth === 0 && closes) break;
	}

	const start = startsLeadingComment(lines, index);
	return {
		code: lines.slice(start, end + 1).join("\n"),
		firstLine: start + 1,
	};
}
