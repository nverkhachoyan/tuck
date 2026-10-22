// Downloads the Noto Emoji images `src/screens/editor/stickers/stickers.ts` names that
// aren't in `assets/stickers/` yet, and makes each one's thumbnail. Run it
// after adding a sticker there: `node scripts/fetch-stickers.mjs`. Thumbnails
// are WebP, a quarter of a PNG's size, made with `cwebp` (`brew install webp`).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NOTO = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main";
const THUMBNAIL_SIZE = 144;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets/stickers");
const thumbnails = join(assets, "thumbnails");
mkdirSync(thumbnails, { recursive: true });

const catalog = readFileSync(
	join(root, "src/screens/editor/stickers/stickers.ts"),
	"utf8",
);
const names = new Set(catalog.match(/emoji_u[0-9a-f_]+\.png/g));

for (const name of names) {
	const image = join(assets, name);
	if (!existsSync(image)) {
		const response = await fetch(`${NOTO}/2D/png/512/${name}`);
		if (!response.ok) throw new Error(`${name}: ${response.status}`);
		writeFileSync(image, Buffer.from(await response.arrayBuffer()));
		console.log(`Fetched ${name}`);
	}
	const thumbnail = join(thumbnails, name.replace(/\.png$/, ".webp"));
	if (!existsSync(thumbnail)) {
		const size = String(THUMBNAIL_SIZE);
		execFileSync("cwebp", [
			"-quiet",
			"-q",
			"90",
			"-resize",
			size,
			size,
			image,
			"-o",
			thumbnail,
		]);
	}
}

// The images' own license, and the repository's, which became the OFL in
// 2024 while the images' stayed Apache 2.0. Neither asks for credit on
// screen.
for (const [name, path] of [
	["LICENSE-APACHE", "2D/svg/LICENSE"],
	["LICENSE-OFL", "LICENSE"],
]) {
	const license = join(assets, name);
	if (existsSync(license)) continue;
	const response = await fetch(`${NOTO}/${path}`);
	if (!response.ok) throw new Error(`${name}: ${response.status}`);
	writeFileSync(license, await response.text());
}
