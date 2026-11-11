/// <reference types="node" />
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const BANNED_MODULES = [
	"react",
	"react-native",
	"react-native-skia",
	"expo",
	"expo-",
];
const EXCEPTIONS = new Set(["textLayerLayout.ts"]);

// `import { … } from "…"` may break across lines. The module is on the `from`
// line, so a scan of lines that start with `import` misses it.
function bannedImports(source: string): string[] {
	const found: string[] = [];
	const pattern =
		/(?:^|\n)[ \t]*import\s+(?:type\s+)?(?:[^;"']*?\sfrom\s+)?["']([^"']+)["']/g;
	for (const match of source.matchAll(pattern)) {
		const specifier = match[1];
		if (!specifier) continue;
		const banned = BANNED_MODULES.some(
			(name) =>
				specifier === name ||
				specifier.startsWith(`${name}/`) ||
				specifier.startsWith(`${name}-`),
		);
		if (banned) found.push(specifier);
	}
	return found;
}

function findPlainTsFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry !== "__tests__") {
				files.push(...findPlainTsFiles(full));
			}
		} else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
			files.push(full);
		}
	}
	return files;
}

describe("import boundaries", () => {
	test("plain document and layer files import no React, React Native, Skia, or Expo", () => {
		const root = join(import.meta.dirname, "../editor");
		const plainFiles = [
			...findPlainTsFiles(join(root, "document")),
			...findPlainTsFiles(join(root, "layers")),
		];
		const violations: string[] = [];

		for (const file of plainFiles) {
			const base = file.split("/").pop() ?? "";
			if (EXCEPTIONS.has(base)) continue;
			for (const specifier of bannedImports(readFileSync(file, "utf8"))) {
				violations.push(`${file}: ${specifier}`);
			}
		}

		assert.deepEqual(violations, []);
	});

	test("a multiline import of a banned module is caught", () => {
		const source = 'import {\n\tSkia,\n} from "react-native-skia";\n';
		assert.deepEqual(bannedImports(source), ["react-native-skia"]);
	});
});
