import { type ComponentProps, type ReactNode, useMemo } from "react";
import {
	BlurMask,
	Group,
	Mask,
	Morphology,
	Paint,
	Path,
	Rect,
	type SkImage,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
} from "react-native-skia";
import { pathFor } from "../drawing/DrawingLayerView";
import { adjustmentMatrix, type ColorMatrix } from "./adjustments";
import type { CutStroke, ImageLayer } from "./image";

const MIRRORED = [{ scaleX: -1 }];
// While a cut is refined, the whole photo shows, and what it selects is
// washed and outlined in the selection color.
const SELECTION_WASH = 0.35;
// The outline's width, as a share of the image's shorter side.
const SELECTION_EDGE = 0.003;

/**
 * Draws an already-decoded image layer in its own space, centered on the
 * origin, mirrored there if it's flipped, colored by its adjustments, and
 * cut out by its decoded `mask` and its `maskStrokes` when it has them.
 * Callers position it with the layer's transform. A live `matrix` (a shared
 * value) colors it instead, while a control is changing its adjustments.
 * `liveMask` is a stroke still being painted on the cut, in the image's own
 * pixels. With a `selectionColor`, the cut doesn't hide anything: the whole
 * image shows, with what the cut keeps washed and outlined in that color,
 * as a selection.
 */
export function ImageLayerView({
	layer,
	image,
	mask,
	matrix,
	liveMask,
	selectionColor,
}: {
	layer: ImageLayer;
	image: SkImage;
	mask?: SkImage;
	matrix?: { value: ColorMatrix };
	liveMask?: ReactNode;
	selectionColor?: string;
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
	const cutMask = cut && (
		<CutMask layer={layer} mask={mask}>
			{liveMask}
		</CutMask>
	);
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			{selectionColor ? (
				<>
					{content}
					{cutMask && (
						<Selection layer={layer} cutMask={cutMask} color={selectionColor}>
							{content}
						</Selection>
					)}
				</>
			) : cutMask ? (
				// The mask covers the image exactly, so nothing needs clipping
				// to it, which would draw the image twice.
				<Mask mode="luminance" clip={false} mask={cutMask}>
					{content}
				</Mask>
			) : (
				content
			)}
		</Group>
	);
}

/**
 * What `cutMask` selects of the image drawn as `children`: washed in
 * `color`, and outlined in it where a dilated copy of the mask reaches past
 * the mask itself (morphology, unlike a runtime shader, works on web).
 */
function Selection({
	layer,
	cutMask,
	color,
	children,
}: {
	layer: ImageLayer;
	cutMask: ReactNode;
	color: string;
	children: ReactNode;
}) {
	const edge = SELECTION_EDGE * Math.min(layer.width, layer.height);
	return (
		<>
			<Mask mode="luminance" clip={false} mask={cutMask}>
				<Group layer>
					{children}
					<Tint layer={layer} color={color} opacity={SELECTION_WASH} />
				</Group>
			</Mask>
			<Mask
				mode="luminance"
				clip={false}
				mask={
					<Group>
						<Group
							layer={
								<Paint>
									<Morphology operator="dilate" radius={edge} />
								</Paint>
							}
						>
							{cutMask}
						</Group>
						<Group layer={<Paint blendMode="difference" />}>{cutMask}</Group>
					</Group>
				}
			>
				<Rect {...imageBox(layer)} color={color} />
			</Mask>
		</>
	);
}

/**
 * A wash of `color` over what's drawn before it in the same layer, only
 * where that has pixels, so a transparent image isn't tinted as a box.
 */
function Tint({
	layer,
	color,
	opacity,
}: {
	layer: ImageLayer;
	color: string;
	opacity?: number;
}) {
	return (
		<Rect
			{...imageBox(layer)}
			color={color}
			opacity={opacity}
			blendMode="srcATop"
		/>
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

/**
 * What an image layer's cut keeps, as white over transparency, in the
 * layer's own space: flipped with it, so it lies over what it keeps.
 */
export function CutCoverage({
	layer,
	mask,
}: {
	layer: ImageLayer;
	mask?: SkImage;
}) {
	return (
		<Group transform={layer.flipped ? MIRRORED : undefined}>
			<Mask
				mode="luminance"
				clip={false}
				mask={<CutMask layer={layer} mask={mask} />}
			>
				<Rect {...imageBox(layer)} color="white" />
			</Mask>
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
 * don't follow the palette. A feathered one's edge is blurred. `path` can be
 * a shared value, for a stroke still growing.
 */
export function MaskStrokePath({
	path,
	stroke,
}: {
	path: ComponentProps<typeof Path>["path"];
	stroke: Omit<CutStroke, "points">;
}) {
	return (
		<Path
			path={path}
			style="stroke"
			strokeCap="round"
			strokeJoin="round"
			strokeWidth={stroke.width}
			color={stroke.type === "pen" ? "white" : "black"}
		>
			{stroke.feather !== undefined && (
				<BlurMask blur={stroke.feather} style="normal" />
			)}
		</Path>
	);
}
