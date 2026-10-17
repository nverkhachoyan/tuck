// Run after the web export: fails if a page has an inline script the Content
// Security Policy in vercel.json doesn't allow by its hash. The browser would
// block it without a word, as when the theme script in +html.tsx changes.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { headers } = JSON.parse(readFileSync("vercel.json", "utf8"));
const policy = headers
	.flatMap((rule) => rule.headers)
	.find(({ key }) => key === "Content-Security-Policy")?.value;
if (!policy) throw new Error("vercel.json has no Content-Security-Policy");
const scriptSources = policy
	.split(";")
	.map((directive) => directive.trim().split(/\s+/))
	.find(([name]) => name === "script-src");

const missing = new Map();
for (const file of readdirSync("dist", { recursive: true })) {
	if (!file.endsWith(".html")) continue;
	const html = readFileSync(join("dist", file), "utf8");
	for (const [, script] of html.matchAll(
		/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
	)) {
		const hash = `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
		if (!scriptSources?.includes(hash)) missing.set(hash, script);
	}
}

if (missing.size > 0) {
	for (const [hash, script] of missing) {
		console.error(`Not in script-src: ${hash}\n${script.slice(0, 200)}\n`);
	}
	console.error(
		"Add these hashes to the Content-Security-Policy in vercel.json.",
	);
	process.exit(1);
}
