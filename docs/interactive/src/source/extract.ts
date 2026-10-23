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
 * The top-level function, type, or constant named `name`, read from the
 * file's current text. Null when it's gone, which a lesson shows rather
 * than hides: the code it explains has moved.
 */
export function extractDeclaration(
	source: string,
	name: string,
): Excerpt | null {
	const lines = source.split("\n");
	const pattern = new RegExp(`^(export )?(function|const|type|let) ${name}\\b`);
	const index = lines.findIndex((line) => pattern.test(line));
	if (index < 0) return null;

	let depth = 0;
	let end = index;
	for (; end < lines.length; end += 1) {
		const code = stripNonCode(lines[end]);
		for (const char of code) {
			if (char === "{") depth += 1;
			if (char === "}") depth -= 1;
		}
		const trimmed = code.trimEnd();
		if (depth === 0 && (trimmed.endsWith("}") || trimmed.endsWith(";"))) {
			break;
		}
	}

	const start = startsLeadingComment(lines, index);
	return {
		code: lines.slice(start, end + 1).join("\n"),
		firstLine: start + 1,
	};
}
