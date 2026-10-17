import {
	Group,
	Mask,
	Path,
	Rect,
	type SkImage,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
} from "@shopify/react-native-skia";
import { type ComponentProps, type ReactNode, useMemo } from "react";
import { adjustmentMatrix, type ColorMatrix } from "@/model/adjustments";
import type { ImageLayer, MaskStroke } from "@/model/document";
import { pathFor } from "./DrawingLayerView";

const MIRRORED = [{ scaleX: -1 }];
// What of a cut-out shows faintly while it's being refined.
const REMOVED_OPACITY = 0.25;

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin, mirrored there if it's flipped, colored by its adjustments, and
 * cut out by its decoded `mask` and its `maskStrokes` when it has them.
 * Callers position it with the layer's transform. A live `matrix` (a shared
 * value) colors it instead, while a control is changing its adjustments.
 * `liveMask` is a stroke still being painted on the cut, in the image's own
 * pixels, and `showRemoved` shows what's cut away faintly, so it can be
 * painted back.
 */
export function ImageLayerView({
	layer,
	image,
	mask,
	matrix,
	liveMask,
	showRemoved = false,
}: {
	layer: ImageLayer;
	image: SkImage;
	mask?: SkImage;
	matrix?: { value: ColorMatrix };
	liveMask?: ReactNode;
	showRemoved?: boolean;
}) {
	const { adjustments, maskStrokes } = layer;
	const saved = useMemo(
		() => adjustments && adjustmentMatrix(adjustments),
		[adjustments],
	);
	const filter = matrix ?? saved;
	const box = imageBox(layer);
	const content = (
		<SkiaImage image={image} {...box} fit="fill">
			{filter && <SkiaColorMatrix matrix={filter} />}
		</SkiaImage>
	);
	const cut = mask || maskStrokes || liveMask;
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			{cut && showRemoved && <Group opacity={REMOVED_OPACITY}>{content}</Group>}
			{cut ? (
				// The mask covers the image exactly, so nothing needs clipping
				// to it, which would draw the image twice.
				<Mask
					mode="luminance"
					clip={false}
					mask={
						<CutMask layer={layer} mask={mask}>
							{liveMask}
						</CutMask>
					}
				>
					{content}
				</Mask>
			) : (
				content
			)}
		</Group>
	);
}

/**
 * What of an image layer its cut shows, in luminance, in the image's own
 * space before it's flipped: its `mask` stretched over it (or white without
 * one), with its `maskStrokes` and then `children` painted over that.
 */
export function CutMask({
	layer,
	mask,
	children,
}: {
	layer: ImageLayer;
	mask?: SkImage;
	children?: ReactNode;
}) {
	const box = imageBox(layer);
	return (
		<Group>
			{mask ? (
				<SkiaImage image={mask} {...box} fit="fill" />
			) : (
				<Rect {...box} color="white" />
			)}
			{layer.maskStrokes?.map((stroke, index) => (
				<MaskStrokePath
					// biome-ignore lint/suspicious/noArrayIndexKey: strokes are only added or removed at the end
					key={index}
					path={pathFor(stroke)}
					stroke={stroke}
				/>
			))}
			{children}
		</Group>
	);
}

/** An image layer's box in its own space, centered on the origin. */
export function imageBox(layer: { width: number; height: number }) {
	return {
		x: -layer.width / 2,
		y: -layer.height / 2,
		width: layer.width,
		height: layer.height,
	};
}

/**
 * A stroke on a cut's mask: a pen paints white, which shows the image, and
 * an eraser black, which hides it. They're luminance, not colors, so they
 * don't follow the palette. `path` can be a shared value, for a stroke still
 * growing.
 */
export function MaskStrokePath({
	path,
	stroke,
}: {
	path: ComponentProps<typeof Path>["path"];
	stroke: Omit<MaskStroke, "points">;
}) {
	return (
		<Path
			path={path}
			style="stroke"
			strokeCap="round"
			strokeJoin="round"
			strokeWidth={stroke.width}
			color={stroke.type === "pen" ? "white" : "black"}
		/>
	);
}
