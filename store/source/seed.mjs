// Writes the store screenshots' projects as the app saves them:
// out/projects/<id>/project.json beside each project's image files. Copy
// them into the app's documents folder (see docs/store-listing.md).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const repo = join(here, "../..");
const out = join(here, "out/projects");
rmSync(out, { recursive: true, force: true });

const T = (x, y, scale = 1, rotation = 0) => ({
	x,
	y,
	scaleX: scale,
	scaleY: scale,
	rotation,
});
const base = (id, transform, locked = false) => ({
	id,
	transform,
	hidden: false,
	locked,
});
const photo = (width, height) => ({
	...base("photo", T(width / 2, height / 2), true),
	type: "image",
	uri: "original.jpg",
	width,
	height,
	flipped: false,
	opaque: true,
});
const sticker = (id, file, x, y, scale, rotation = 0) => ({
	...base(id, T(x, y, scale, rotation)),
	type: "image",
	uri: file,
	width: 512,
	height: 512,
	flipped: false,
	opaque: false,
	sticker: true,
});
// A box from its top-left corner, padded.
const box = (id, [x, y, w, h], pad, effect) => ({
	...base(id, T(x + w / 2, y + h / 2)),
	type: "redaction",
	shape: "box",
	effect,
	width: w + pad * 2,
	height: h + pad * 2,
});
const text = (id, x, y, fields) => ({
	...base(id, T(x, y)),
	type: "text",
	outlineColor: null,
	backgroundColor: null,
	align: "center",
	...fields,
});
const arrow = (id, [x1, y1], [x2, y2], color, strokeWidth) => ({
	...base(id, T((x1 + x2) / 2, (y1 + y2) / 2, 1, Math.atan2(y2 - y1, x2 - x1))),
	type: "shape",
	shape: "arrow",
	color,
	strokeWidth,
	length: Math.hypot(x2 - x1, y2 - y1),
});

const now = Date.now();
let order = 0;
function project(id, document, files, name) {
	const folder = join(out, id);
	mkdirSync(folder, { recursive: true });
	for (const [name, source] of Object.entries(files)) {
		copyFileSync(source, join(folder, name));
	}
	// Listed newest first: the first written here is shown first.
	const updatedAt = now - order++ * 60_000;
	writeFileSync(
		join(folder, "project.json"),
		JSON.stringify({
			version: 5,
			createdAt: updatedAt,
			updatedAt,
			document: { groups: [], ...document },
			...(name && { name }),
		}),
	);
}

// Rendered from content/*.html by `compose.sh content`.
const content = join(here, "out/content");
const emoji = (code) => join(repo, `assets/stickers/emoji_u${code}.png`);
const shortSide = 1179;

project(
	"store-redact",
	{
		width: 1179,
		height: 2556,
		background: "#FFFFFF",
		layers: [
			photo(1179, 2556),
			box("blur", [482, 180, 215, 216], 14, {
				type: "blur",
				radius: 0.03 * shortSide,
			}),
			box("pixels", [78, 1438, 760, 110], 12, {
				type: "pixelate",
				size: 0.035 * shortSide,
			}),
			box("code", [372, 1628, 109, 57], 6, { type: "solid", color: "#000000" }),
			box("phone", [396, 1692, 352, 57], 6, {
				type: "solid",
				color: "#000000",
			}),
		],
	},
	{ "original.jpg": join(content, "chat.jpg") },
	"Saturday plans",
);

project(
	"store-caption",
	{
		width: 1080,
		height: 1350,
		background: "#FFFFFF",
		layers: [
			photo(1080, 1350),
			text("caption", 540, 250, {
				text: "WEEKEND\nMODE: ON",
				font: "classic",
				fontSize: 150,
				color: "#FFFFFF",
				outlineColor: "#000000",
				maxWidth: 1000,
			}),
			sticker("shades", "image-shades.png", 830, 1130, 0.62, -0.18),
		],
	},
	{
		"original.jpg": join(content, "scene.jpg"),
		"image-shades.png": emoji("1f60e"),
	},
);

project(
	"store-markup",
	{
		width: 1179,
		height: 2556,
		background: "#FFFFFF",
		layers: [
			photo(1179, 2556),
			{
				...base("circle", T(1012, 967)),
				type: "shape",
				shape: "ellipse",
				color: "#FF3B30",
				strokeWidth: 12,
				width: 250,
				height: 170,
			},
			arrow("arrow", [640, 1250], [905, 1045], "#FF3B30", 14),
			text("note", 420, 1310, {
				text: "Turn this on!",
				font: "marker",
				fontSize: 92,
				color: "#000000",
				backgroundColor: "#FFE433",
				maxWidth: 900,
			}),
		],
	},
	{ "original.jpg": join(content, "settings.jpg") },
);

project(
	"store-party",
	{
		width: 1080,
		height: 1920,
		background: "#FFE433",
		layers: [
			text("title", 540, 760, {
				text: "PARTY\nAT 7",
				font: "classic",
				fontSize: 280,
				color: "#000000",
				maxWidth: 1000,
			}),
			sticker("popper", "image-popper.png", 540, 1340, 1.05, 0.12),
			sticker("sparkles", "image-sparkles.png", 860, 380, 0.5, 0.2),
		],
	},
	{
		"image-popper.png": emoji("1f389"),
		"image-sparkles.png": emoji("2728"),
	},
);

console.log("wrote", out);

// The same chat with nothing hidden yet, for Find.
project(
	"store-find",
	{
		width: 1179,
		height: 2556,
		background: "#FFFFFF",
		layers: [photo(1179, 2556)],
	},
	{ "original.jpg": join(content, "chat.jpg") },
	"Chat",
);
