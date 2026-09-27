import type { Bbox, Worker } from "tesseract.js";
import type { Rect, TextRegion } from "./ImageAnalysis.types";

// Copied into public/ by scripts/copy-web-assets.mjs, so nothing is fetched
// from a CDN.
const ASSETS = "/tesseract";

// Tesseract reads icons as words too, but only real text has a letter or a
// digit. Its confidence can't tell them apart: it scores gray text it
// misreads at 0, higher than an icon.
const TEXT = /[\p{L}\p{N}]/u;

// Tesseract runs a screenshot's label and the value across from it into one
// line. A gap this many times the words' height starts a new one, as Vision
// and ML Kit do.
const MAX_WORD_GAP = 1.5;

let worker: Promise<Worker> | undefined;

// Started on first use, so neither the library nor its WebAssembly loads
// until someone looks for text.
function textWorker(): Promise<Worker> {
	if (!worker) {
		const starting = import("tesseract.js").then(({ createWorker, OEM }) =>
			createWorker("eng", OEM.LSTM_ONLY, {
				workerPath: `${ASSETS}/worker.min.js`,
				corePath: ASSETS,
				langPath: ASSETS,
				workerBlobURL: false,
			}),
		);
		// Try again next time, say once the connection is back.
		starting.catch(() => {
			if (worker === starting) worker = undefined;
		});
		worker = starting;
	}
	return worker;
}

/** Tesseract applies the image's EXIF orientation before it looks. */
export async function tesseractText(uri: string): Promise<TextRegion[]> {
	const { data } = await (await textWorker()).recognize(
		uri,
		{},
		{ text: false, blocks: true },
	);
	const regions: TextRegion[] = [];
	for (const block of data.blocks ?? []) {
		for (const paragraph of block.paragraphs) {
			for (const line of paragraph.lines) {
				const words = line.words
					.filter((word) => TEXT.test(word.text))
					.map((word) => rect(word.bbox));
				// The line's own box would still cover the words left out.
				for (const run of splitAtGaps(words)) {
					regions.push({ line: union(run), words: run });
				}
			}
		}
	}
	return regions;
}

function splitAtGaps(words: Rect[]): Rect[][] {
	const runs: Rect[][] = [];
	let run: Rect[] = [];
	for (const word of words) {
		const previous = run.at(-1);
		if (previous) {
			const gap = word.x - (previous.x + previous.width);
			const height = Math.min(word.height, previous.height);
			if (gap > height * MAX_WORD_GAP) {
				runs.push(run);
				run = [];
			}
		}
		run.push(word);
	}
	if (run.length > 0) runs.push(run);
	return runs;
}

function rect({ x0, y0, x1, y1 }: Bbox): Rect {
	return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function union(rects: Rect[]): Rect {
	const left = Math.min(...rects.map((r) => r.x));
	const top = Math.min(...rects.map((r) => r.y));
	const right = Math.max(...rects.map((r) => r.x + r.width));
	const bottom = Math.max(...rects.map((r) => r.y + r.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}
