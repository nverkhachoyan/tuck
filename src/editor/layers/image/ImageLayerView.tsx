import { type ComponentProps, type ReactNode, useMemo } from "react";
import {
	BlurMask,
	Group,
	ImageFilter,
	Mask,
	Morphology,
	Paint,
	Path,
	Rect,
	rect,
	type SkImage,
	type SkImageFilter,
	Skia,
	ColorMatrix as SkiaColorMatrix,
	Image as SkiaImage,
	TileMode,
} from "react-native-skia";
import { pathFor } from "../drawing/DrawingLayerView";
import { adjustmentMatrix, type ColorMatrix } from "./adjustments";
import type { CutStroke, ImageLayer } from "./image";
import {
	type MaskEdgeFilterSpec,
	maskEdgeBorderInset,
	maskEdgeFilter,
	maskEdgePad,
} from "./mask";

const MIRRORED = [{ scaleX: -1 }];
// Converts an image's alpha channel into opaque grayscale luminance
// (R = A, G = A, B = A, A = 1) so transparent PNGs and stickers run through
// the same mask edge filter pipeline as cut-out masks.
// biome-ignore format: a matrix reads best in rows
const ALPHA_TO_LUMINANCE: ColorMatrix = [
	0, 0, 0, 1, 0,
	0, 0, 0, 1, 0,
	0, 0, 0, 1, 0,
	0, 0, 0, 0, 1,
];
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
	const hasCut = Boolean(mask || maskStrokes || liveMask);
	const hasEdge = useMemo(
		() => maskEdgeFilter(layer.maskEdge, layer) !== null,
		[layer],
	);
	const cutMask = (hasCut || hasEdge) && (
		<CutMask layer={layer} image={image} mask={mask}>
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
 * Builds the composed Skia image filter for a cut's `maskEdge` (Shift →
 * Smooth → Feather), using only filters CanvasKit supports on web.
 */
function buildMaskEdgeFilter(spec: MaskEdgeFilterSpec): SkImageFilter | null {
	let filter: SkImageFilter | null = null;
	if (spec.shift) {
		const { operator, radius } = spec.shift;
		filter =
			operator === "dilate"
				? Skia.ImageFilter.MakeDilate(radius, radius, filter)
				: Skia.ImageFilter.MakeErode(radius, radius, filter);
	}
	if (spec.smooth) {
		const { sigma, matrix } = spec.smooth;
		filter = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, filter);
		filter = Skia.ImageFilter.MakeColorFilter(
			Skia.ColorFilter.MakeMatrix(matrix),
			filter,
		);
	}
	if (spec.feather) {
		const { sigma } = spec.feather;
		filter = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, filter);
	}
	return filter;
}

/**
 * What of an image layer its cut or edge refinement shows, in luminance, in
 * the image's own space before it's flipped:
 * - Cut-out image (`mask`, `maskStrokes`, or live `children`): mask + strokes,
 *   clamped to the image's box so subjects touching the border stay flush.
 * - Uncut transparent PNG / sticker (`!layer.opaque`, `image` given): the
 *   image's own alpha channel converted to luminance, refined by `maskEdge`.
 * - Uncut opaque photo (`layer.opaque`): white inside the image's box over a
 *   padded black surround (inset on Feather for a seamless edge fade).
 */
export function CutMask({
	layer,
	image,
	mask,
	children,
}: {
	layer: ImageLayer;
	image?: SkImage;
	mask?: SkImage;
	children?: ReactNode;
}) {
	const box = imageBox(layer);
	const hasCut = Boolean(mask || layer.maskStrokes || children);
	const edge = useMemo(() => {
		const spec = maskEdgeFilter(layer.maskEdge, {
			width: layer.width,
			height: layer.height,
		});
		const filter = spec ? buildMaskEdgeFilter(spec) : null;
		return spec && filter ? { spec, filter } : null;
	}, [layer.maskEdge, layer.width, layer.height]);

	if (!hasCut && edge) {
		if (!layer.opaque && image) {
			const clip = rect(box.x, box.y, box.width, box.height);
			return (
				<Group clip={clip}>
					<Group
						layer={
							<Paint>
								<ImageFilter filter={edge.filter} />
							</Paint>
						}
					>
						<Rect {...box} color="black" />
						<SkiaImage image={image} {...box} fit="fill">
							<SkiaColorMatrix matrix={ALPHA_TO_LUMINANCE} />
						</SkiaImage>
					</Group>
				</Group>
			);
		}
		// Uncut opaque photo: pad with black around the image box so Smooth rounds
		// corners, negative Shift insets the border, and Feather fades seamlessly.
		const pad = maskEdgePad(edge.spec);
		const inset = maskEdgeBorderInset(edge.spec, layer);
		const padded = rect(
			box.x - pad,
			box.y - pad,
			box.width + pad * 2,
			box.height + pad * 2,
		);
		return (
			<Group clip={padded}>
				<Group
					layer={
						<Paint>
							<ImageFilter filter={edge.filter} />
						</Paint>
					}
				>
					<Rect rect={padded} color="black" />
					<Rect
						x={box.x + inset}
						y={box.y + inset}
						width={Math.max(0, box.width - inset * 2)}
						height={Math.max(0, box.height - inset * 2)}
						color="white"
					/>
				</Group>
			</Group>
		);
	}

	const content = (
		<>
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
		</>
	);
	if (!edge) return <Group>{content}</Group>;
	// Clip outside the saved layer so the layer is bounded to the image box
	// and TileMode.Clamp clamps at the image's edges.
	const clip = rect(box.x, box.y, box.width, box.height);
	return (
		<Group clip={clip}>
			<Group
				layer={
					<Paint>
						<ImageFilter filter={edge.filter} />
					</Paint>
				}
			>
				{content}
			</Group>
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
