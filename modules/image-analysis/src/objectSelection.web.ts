import type { ImagePoint, ObjectMasks } from "./ImageAnalysis.types";
import { decode } from "./mediaPipe";

// MobileSAM's encoder looks at the image at this size on its longer side.
const ENCODER_SIDE = 1024;

type Reply = { id: number; error?: string; masks?: Blob[]; likeliest?: number };

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (reply: Reply) => void>();
let prepared: {
	uri: string;
	width: number;
	height: number;
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
		ready: false,
		done: Promise.resolve(),
	};
	preparing.done = (async () => {
		const image = await decode(uri);
		const scale = ENCODER_SIDE / Math.max(image.width, image.height);
		const width = Math.round(image.width * scale);
		const height = Math.round(image.height * scale);
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
		if (prepared === preparing) preparing.ready = true;
	})();
	preparing.done.catch(() => {
		if (prepared === preparing) prepared = null;
	});
	prepared = preparing;
	return preparing.done;
}

/**
 * Masks of what's at a point in the image at `uri` (see `ObjectMasks`), as
 * grayscale PNGs' blob URLs. Null while the image isn't ready (see
 * `prepareObjects`).
 */
export async function objectMasks(
	uri: string,
	at: ImagePoint,
): Promise<ObjectMasks | null> {
	if (!prepared?.ready || prepared.uri !== uri) return null;
	const { width, height } = prepared;
	const { masks = [], likeliest = 0 } = await ask({
		type: "select",
		x: at.x * width,
		y: at.y * height,
	});
	return {
		masks: masks.map((blob) => ({
			uri: URL.createObjectURL(blob),
			width,
			height,
		})),
		likeliest,
	};
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
