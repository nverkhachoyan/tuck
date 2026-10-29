import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ImageFormat, type SkImage } from "react-native-skia";
import { drawOffscreen, renderDocument } from "@/editor";
import type { EditorDocument } from "@/editor/core";

// The largest the preview's own copy is, in pixels: the export sheet's strip
// at 3x.
const PREVIEW_MAX = { width: 1400, height: 700 };

export type RenderState =
	// `previous` is the last render's preview, shown while this one runs.
	| { status: "rendering"; previous: string | null }
	| { status: "ready"; image: SkImage; preview: string }
	| { status: "failed"; error: unknown };

/**
 * The document rendered at `scale`, with a small copy of it as a PNG data
 * URL to preview, one render at a time: quick changes of size start only the
 * latest, once the one running has finished, rather than several full-size
 * renders at once. While a render runs, the last preview stays shown. A
 * render that finishes after it's been superseded is disposed instead of
 * shown. The preview is a string, so nothing that shows it holds the image,
 * which is disposed as soon as it's replaced.
 */
export function useRenderedDocument(document: EditorDocument, scale: number) {
	const [state, setState] = useState<RenderState>({
		status: "rendering",
		previous: null,
	});
	const [attempt, setAttempt] = useState(0);
	const running = useRef<Promise<void>>(Promise.resolve());

	useEffect(() => {
		// Re-run when retrying, even though the document hasn't changed.
		void attempt;
		let cancelled = false;
		let rendered: SkImage | null = null;

		setState((current) => ({
			status: "rendering",
			previous:
				current.status === "ready"
					? current.preview
					: current.status === "rendering"
						? current.previous
						: null,
		}));
		running.current = running.current.then(async () => {
			if (cancelled) return;
			try {
				const image = await renderDocument(document, scale);
				const preview = cancelled ? null : await previewOf(image);
				if (cancelled || !preview) {
					image.dispose();
					return;
				}
				rendered = image;
				setState({ status: "ready", image, preview });
			} catch (error) {
				if (!cancelled) setState({ status: "failed", error });
			}
		});

		return () => {
			cancelled = true;
			rendered?.dispose();
		};
	}, [document, scale, attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	return { state, retry };
}

// A copy of `image` no larger than `PREVIEW_MAX`, as a PNG data URL, which
// keeps transparency for the sheet to show as the file will.
async function previewOf(image: SkImage): Promise<string | null> {
	const fit = Math.min(
		1,
		PREVIEW_MAX.width / image.width(),
		PREVIEW_MAX.height / image.height(),
	);
	const width = Math.max(1, Math.round(image.width() * fit));
	const height = Math.max(1, Math.round(image.height() * fit));
	const small = await drawOffscreen(
		<Image image={image} x={0} y={0} width={width} height={height} />,
		{ width, height },
	);
	if (!small) return null;
	try {
		return `data:image/png;base64,${small.encodeToBase64(ImageFormat.PNG)}`;
	} finally {
		small.dispose();
	}
}
