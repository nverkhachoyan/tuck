import type {
	ImageBox,
	ObjectMasks,
	ObjectPrompt,
	SubjectMask,
} from "./ImageAnalysis.types";
import { decode } from "./mediaPipe";
import {
	ENCODER_SIDE,
	type ObjectCropPlan,
	planObjectCrop,
} from "./objectCrop";

type Reply = { id: number; error?: string; masks?: Blob[]; likeliest?: number };

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (reply: Reply) => void>();
let prepared: {
	uri: string;
	width: number;
	height: number;
	sourceWidth: number;
	sourceHeight: number;
	ready: boolean;
	done: Promise<void>;
} | null = null;

export function canSelectObjects(): boolean {
	return (
		typeof Worker === "function" &&
		typeof OffscreenCanvas === "function" &&
		typeof WebAssembly === "object"
	);
}

function ask(message: object, transfer: Transferable[] = []): Promise<Reply> {
	if (!worker) {
		worker = new Worker("/mobile-sam-worker.js", { type: "module" });
		worker.addEventListener("message", ({ data }: MessageEvent<Reply>) => {
			waiting.get(data.id)?.(data);
			waiting.delete(data.id);
		});
	}
	const id = nextId++;
	const reply = new Promise<Reply>((resolve) => waiting.set(id, resolve));
	worker.postMessage({ ...message, id }, transfer);
	return reply.then((answer) => {
		if (answer.error !== undefined) throw new Error(answer.error);
		return answer;
	});
}

/**
 * Starts reading the image at `uri` for selecting objects in it: loads the
 * model, the first time, and encodes the image, in a worker. Resolves once
 * taps on it can be answered. A new image takes the place of the last.
 */
export function prepareObjects(uri: string): Promise<void> {
	if (prepared?.uri === uri) return prepared.done;
	const preparing: NonNullable<typeof prepared> = {
		uri,
		width: 0,
		height: 0,
		sourceWidth: 0,
		sourceHeight: 0,
		ready: false,
		done: Promise.resolve(),
	};
	preparing.done = (async () => {
		const image = await decode(uri);
		const sourceWidth = image.width;
		const sourceHeight = image.height;
		const scale = ENCODER_SIDE / Math.max(sourceWidth, sourceHeight);
		const width = Math.round(sourceWidth * scale);
		const height = Math.round(sourceHeight * scale);
		let sized: ImageBitmap;
		try {
			sized = await createImageBitmap(image, {
				resizeWidth: width,
				resizeHeight: height,
				resizeQuality: "high",
			});
		} finally {
			image.close();
		}
		await ask({ type: "encode", image: sized }, [sized]);
		preparing.width = width;
		preparing.height = height;
		preparing.sourceWidth = sourceWidth;
		preparing.sourceHeight = sourceHeight;
		if (prepared === preparing) preparing.ready = true;
	})();
	preparing.done.catch(() => {
		if (prepared === preparing) prepared = null;
	});
	prepared = preparing;
	return preparing.done;
}

/**
 * Masks of the object `prompt` points at or boxes in the image at `uri` (see
 * `ObjectMasks`), as grayscale PNGs' blob URLs. Null while a point's image
 * isn't ready (see `prepareObjects`); a box waits for its image, and is null
 * only if reading it fails or it's let go meanwhile.
 */
export async function objectMasks(
	uri: string,
	prompt: ObjectPrompt,
): Promise<ObjectMasks | null> {
	const reading = await whenRead(uri, prompt);
	if (!reading) return null;
	if ("box" in prompt) {
		const plan = planObjectCrop(
			{ width: reading.sourceWidth, height: reading.sourceHeight },
			prompt.box,
		);
		if (plan) {
			const cropped = await cropForEncoder(uri, plan);
			const { masks = [] } = await ask(
				{
					type: "selectCrop",
					image: cropped,
					box: plan.promptBox,
					outputWidth: plan.output.width,
					outputHeight: plan.output.height,
					paste: plan.paste,
				},
				[cropped],
			);
			if (masks.length > 0) {
				return {
					masks: masks.map((blob) => ({
						uri: URL.createObjectURL(blob),
						width: plan.output.width,
						height: plan.output.height,
					})),
					likeliest: 0,
				};
			}
		}
	}
	const { width, height } = reading;
	const { masks = [], likeliest = 0 } = await ask(
		"point" in prompt
			? {
					type: "select",
					x: prompt.point.x * width,
					y: prompt.point.y * height,
				}
			: {
					type: "select",
					box: [
						prompt.box.x * width,
						prompt.box.y * height,
						(prompt.box.x + prompt.box.width) * width,
						(prompt.box.y + prompt.box.height) * height,
					],
				},
	);
	return {
		masks: masks.map((blob) => ({
			uri: URL.createObjectURL(blob),
			width,
			height,
		})),
		likeliest,
	};
}

/**
 * Refines a single normalized `box` on the image at `uri` using the shared
 * MobileSAM worker. Small subjects use `selectCrop` directly without encoding
 * the whole image; larger subjects reuse or populate the whole-image encoding
 * (so opening Cut → Refine afterward is instant).
 */
export async function refineBoxMask(
	uri: string,
	box: ImageBox,
): Promise<SubjectMask | null> {
	if (!canSelectObjects()) return null;
	const source =
		prepared?.uri === uri && prepared.sourceWidth > 0
			? { width: prepared.sourceWidth, height: prepared.sourceHeight }
			: await imageDimensions(uri);
	const plan = planObjectCrop(source, box);
	if (plan) {
		const cropped = await cropForEncoder(uri, plan);
		const { masks = [] } = await ask(
			{
				type: "selectCrop",
				image: cropped,
				box: plan.promptBox,
				outputWidth: plan.output.width,
				outputHeight: plan.output.height,
				paste: plan.paste,
			},
			[cropped],
		);
		const blob = masks[0];
		if (blob) {
			return {
				uri: URL.createObjectURL(blob),
				width: plan.output.width,
				height: plan.output.height,
			};
		}
	}
	await prepareObjects(uri);
	const result = await objectMasks(uri, { box });
	return result?.masks[result.likeliest] ?? result?.masks[0] ?? null;
}

async function imageDimensions(
	uri: string,
): Promise<{ width: number; height: number }> {
	const image = await decode(uri);
	try {
		return { width: image.width, height: image.height };
	} finally {
		image.close();
	}
}

async function cropForEncoder(
	uri: string,
	plan: ObjectCropPlan,
): Promise<ImageBitmap> {
	const image = await decode(uri);
	try {
		const canvas = new OffscreenCanvas(plan.encode.width, plan.encode.height);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Couldn't crop the image");
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(
			image,
			plan.source.x,
			plan.source.y,
			plan.source.width,
			plan.source.height,
			0,
			0,
			plan.encode.width,
			plan.encode.height,
		);
		return canvas.transferToImageBitmap();
	} finally {
		image.close();
	}
}

// The image at `uri` once it's read for `prompt`, or null: a point takes it
// only once it's ready, while a box waits for it, since the subject at a
// box's center is a poor stand-in for what it boxes.
async function whenRead(uri: string, prompt: ObjectPrompt) {
	const reading = prepared?.uri === uri ? prepared : null;
	if (!reading) return null;
	if (reading.ready) return reading;
	if (!("box" in prompt)) return null;
	try {
		await reading.done;
	} catch {
		return null;
	}
	return prepared === reading ? reading : null;
}

export function releaseObjects() {
	worker?.terminate();
	worker = null;
	prepared = null;
	for (const resolve of waiting.values()) {
		resolve({ id: -1, error: "Selecting objects was stopped." });
	}
	waiting.clear();
}
