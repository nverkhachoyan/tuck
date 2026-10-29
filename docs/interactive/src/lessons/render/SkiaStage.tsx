import { LoadFonts } from "@src/render/fonts.ts";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, Group } from "react-native-skia";

/**
 * A Skia canvas fit to its column, drawing `children` in document space. It
 * mounts once it knows its width: on web, Skia can drop the first redraws
 * of a canvas whose surface is still being set up. Text needs the app's
 * fonts, so it waits for `LoadFonts`, as the editor does.
 */
export function SkiaStage({
	width,
	height,
	children,
}: {
	width: number;
	height: number;
	children: ReactNode;
}) {
	const box = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(0);

	useEffect(() => {
		const element = box.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) =>
			setShown(Math.floor(entry.contentRect.width)),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const scale = shown / width;
	return (
		<div
			ref={box}
			className="skia-stage"
			style={{ aspectRatio: `${width} / ${height}` }}
		>
			{shown > 0 && (
				<Suspense fallback={<p className="hint">Loading fonts…</p>}>
					<LoadFonts />
					<Canvas
						style={{ width: shown, height: height * scale }}
						colorSpace="srgb"
					>
						<Group transform={[{ scale }]}>{children}</Group>
					</Canvas>
				</Suspense>
			)}
		</div>
	);
}
