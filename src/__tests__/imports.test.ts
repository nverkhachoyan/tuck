/// <reference types="node" />
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const SRC_ROOT = resolve(import.meta.dirname, "..");

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

// Static runtime imports and re-exports (omitting `import type`, `export type`,
// and dynamic `import(...)`).
function staticValueSpecifiers(source: string): string[] {
	const found: string[] = [];
	const pattern =
		/(?:^|\n)[ \t]*(?:import|export)\s+(?!type\b)(?:[^;"']*?\sfrom\s+)?["']([^"']+)["']/g;
	for (const match of source.matchAll(pattern)) {
		const specifier = match[1];
		if (specifier) found.push(specifier);
	}
	return found;
}

// Metro's web resolution order (AGENTS.md): `.web.ts`, `.ts`, `.web.tsx`, `.tsx`.
const WEB_EXTENSIONS = [
	".web.ts",
	".ts",
	".web.tsx",
	".tsx",
	"/index.web.ts",
	"/index.ts",
	"/index.web.tsx",
	"/index.tsx",
];

function resolveWebModule(fromFile: string, specifier: string): string | null {
	let base: string;
	if (specifier.startsWith("@/")) {
		base = join(SRC_ROOT, specifier.slice(2));
	} else if (specifier.startsWith(".")) {
		base = resolve(dirname(fromFile), specifier);
	} else {
		return null;
	}
	if (existsSync(base) && statSync(base).isFile()) return base;
	for (const ext of WEB_EXTENSIONS) {
		const candidate = `${base}${ext}`;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

function isSkiaModule(specifier: string): boolean {
	return (
		specifier === "react-native-skia" ||
		specifier.startsWith("react-native-skia/")
	);
}

/**
 * Walks static runtime imports on web from `entry` and returns the shortest
 * chain that reaches `react-native-skia`, or null if none does.
 */
function findStaticPathToSkia(entry: string): string[] | null {
	const visited = new Set<string>([entry]);
	const queue: { file: string; trail: string[] }[] = [
		{ file: entry, trail: [relative(REPO_ROOT, entry)] },
	];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		const source = readFileSync(current.file, "utf8");
		for (const specifier of staticValueSpecifiers(source)) {
			if (isSkiaModule(specifier)) {
				return [...current.trail, specifier];
			}
			const next = resolveWebModule(current.file, specifier);
			if (!next || visited.has(next)) continue;
			visited.add(next);
			queue.push({
				file: next,
				trail: [...current.trail, relative(REPO_ROOT, next)],
			});
		}
	}
	return null;
}

function findFiles(dir: string, match: (name: string) => boolean): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry !== "__tests__") {
				files.push(...findFiles(full, match));
			}
		} else if (match(entry)) {
			files.push(full);
		}
	}
	return files;
}

function findPlainTsFiles(dir: string): string[] {
	return findFiles(
		dir,
		(name) => name.endsWith(".ts") && !name.endsWith(".d.ts"),
	);
}

describe("import boundaries", () => {
	test("plain document and layer files import no React, React Native, Skia, or Expo", () => {
		const root = join(SRC_ROOT, "editor");
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

	test("web entry and app routes never reach react-native-skia through static imports", () => {
		const routes = findFiles(
			join(SRC_ROOT, "app"),
			(name) =>
				(name.endsWith(".ts") || name.endsWith(".tsx")) &&
				!name.endsWith(".d.ts"),
		);
		const entries = [join(REPO_ROOT, "index.web.ts"), ...routes];
		const chains: string[] = [];

		for (const entry of entries) {
			const chain = findStaticPathToSkia(entry);
			if (chain) chains.push(chain.join(" -> "));
		}

		assert.deepEqual(chains, []);
	});

	test("static value specifier scan catches re-exports and ignores type-only or dynamic imports", () => {
		const source = [
			'import type { SkImage } from "react-native-skia";',
			'export type { Foo } from "./foo";',
			'export { default } from "@/screens/home/HomeScreen";',
			'const lazy = () => import("react-native-skia");',
		].join("\n");
		assert.deepEqual(staticValueSpecifiers(source), [
			"@/screens/home/HomeScreen",
		]);
	});
});
