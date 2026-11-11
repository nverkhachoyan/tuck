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

function findPlainTsFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry !== "__tests__" && entry !== "panel") {
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
			const source = readFileSync(file, "utf8");
			for (const line of source.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("import ")) continue;
				for (const banned of BANNED_MODULES) {
					if (line.includes(`"${banned}`) || line.includes(`'${banned}`)) {
						violations.push(`${file}: ${trimmed}`);
					}
				}
			}
		}

		assert.deepEqual(violations, []);
	});
});
