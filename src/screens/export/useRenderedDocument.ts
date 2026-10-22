import type { SkImage } from "@shopify/react-native-skia";
import { useCallback, useEffect, useState } from "react";
import type { EditorDocument } from "@/model/document";
import { renderDocument } from "@/render/renderDocument";

export type RenderState =
	| { status: "rendering" }
	| { status: "ready"; image: SkImage }
	| { status: "failed"; error: unknown };

/**
 * A render that finishes after it's been superseded is disposed instead of
 * shown.
 */
export function useRenderedDocument(document: EditorDocument, scale: number) {
	const [state, setState] = useState<RenderState>({ status: "rendering" });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		// Re-run when retrying, even though the document hasn't changed.
		void attempt;
		let cancelled = false;
		let rendered: SkImage | null = null;

		setState({ status: "rendering" });
		renderDocument(document, scale).then(
			(image) => {
				if (cancelled) {
					image.dispose();
					return;
				}
				rendered = image;
				setState({ status: "ready", image });
			},
			(error: unknown) => {
				if (!cancelled) setState({ status: "failed", error });
			},
		);

		return () => {
			cancelled = true;
			rendered?.dispose();
		};
	}, [document, scale, attempt]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	return { state, retry };
}
