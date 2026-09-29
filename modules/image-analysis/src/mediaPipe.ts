import type * as Vision from "@mediapipe/tasks-vision";

// Copied into public/ by scripts/copy-web-assets.mjs, so nothing is fetched
// from a CDN or Google's storage.
export const ASSETS = "/mediapipe";

let vision: Promise<typeof Vision> | undefined;

// Metro can't bundle the library: every build of it calls `import()` with a
// computed path, which Metro rejects. Its script build defines a global
// `Vision` instead. Loaded once, on first use, for every task.
export function loadVision(): Promise<typeof Vision> {
	if (!vision) {
		demoteInfoLogs();
		const loading = new Promise<typeof Vision>((resolve, reject) => {
			const script = document.createElement("script");
			script.src = `${ASSETS}/vision_bundle.js`;
			script.onload = () => {
				const loaded = (globalThis as { Vision?: typeof Vision }).Vision;
				if (loaded) resolve(loaded);
				else reject(new Error("MediaPipe didn't load"));
			};
			script.onerror = () => {
				script.remove();
				reject(new Error("Couldn't load MediaPipe"));
			};
			document.head.append(script);
		});
		// Try again next time, say once the connection is back.
		loading.catch(() => {
			if (vision === loading) vision = undefined;
		});
		vision = loading;
	}
	return vision;
}

type WasmFileset = Awaited<
	ReturnType<typeof Vision.FilesetResolver.forVisionTasks>
>;

/**
 * A MediaPipe task, created on first use so neither the library nor its
 * WebAssembly loads until someone needs it. A failed start is tried again
 * by the next caller.
 */
export function lazyTask<T>(
	create: (vision: typeof Vision, fileset: WasmFileset) => Promise<T>,
): () => Promise<T> {
	let task: Promise<T> | undefined;
	return () => {
		if (!task) {
			const starting = loadVision().then(async (loaded) =>
				create(loaded, await loaded.FilesetResolver.forVisionTasks(ASSETS)),
			);
			starting.catch(() => {
				if (task === starting) task = undefined;
			});
			task = starting;
		}
		return task;
	};
}

// MediaPipe's WebAssembly writes every log line to stderr, which reaches
// `console.error`, so the development build's overlay showed "INFO: Created
// TensorFlow Lite XNNPACK delegate" as an error after every first Find.
let infoLogsDemoted = false;
function demoteInfoLogs() {
	if (infoLogsDemoted) return;
	infoLogsDemoted = true;
	const error = console.error;
	console.error = (...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("INFO: ")) {
			console.info(...args);
		} else {
			error(...args);
		}
	};
}

// MediaPipe looks at the pixels it's handed, so the image is decoded with its
// EXIF orientation applied first.
export async function decode(uri: string): Promise<ImageBitmap> {
	const response = await fetch(uri);
	if (!response.ok) throw new Error(`Couldn't read the image at ${uri}`);
	return createImageBitmap(await response.blob(), {
		imageOrientation: "from-image",
	});
}
