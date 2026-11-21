import {
	AlphaType,
	ColorType,
	FilterMode,
	ImageShader,
	MipmapMode,
	Rect,
	type SkImage,
	Skia,
	type SkRect,
} from "react-native-skia";
import { parseHex } from "@/ui/color";
import { CHECKER_CELL, colors } from "@/ui/theme";

const CHECKER_SAMPLING = {
	filter: FilterMode.Nearest,
	mipmap: MipmapMode.None,
} as const;

// A 2×2 tile of the palette's light and dark squares, tiled on the GPU by
// ImageShader. Built lazily on first draw so module load doesn't touch Skia
// before CanvasKit is ready on web; the palette never changes while running.
let checkerTile: SkImage | null = null;

function getCheckerTile(): SkImage {
	if (checkerTile) return checkerTile;
	const light = parseHex(colors.checkerLight) ?? [237, 238, 240];
	const dark = parseHex(colors.checkerDark) ?? [211, 213, 217];
	const pixels = new Uint8Array([
		light[0],
		light[1],
		light[2],
		255,
		dark[0],
		dark[1],
		dark[2],
		255,
		dark[0],
		dark[1],
		dark[2],
		255,
		light[0],
		light[1],
		light[2],
		255,
	]);
	const image = Skia.Image.MakeRaster(
		{
			width: 2,
			height: 2,
			colorType: ColorType.RGBA_8888,
			alphaType: AlphaType.Opaque,
		},
		Skia.Data.fromBytes(pixels),
		8,
	);
	if (!image) throw new Error("Couldn't create checkerboard tile.");
	checkerTile = image;
	return image;
}

/**
 * The checkerboard that stands for transparency, filling `bounds`. `cell` is
 * a square's side in the same units as `bounds`, so a caller drawing in
 * document space passes its on-screen size divided by the view's scale.
 */
export function Checkerboard({
	bounds,
	cell,
}: {
	bounds: SkRect;
	cell: number;
}) {
	const tile = getCheckerTile();
	const period = cell * 2;
	return (
		<Rect rect={bounds}>
			<ImageShader
				image={tile}
				tx="repeat"
				ty="repeat"
				fit="fill"
				x={bounds.x}
				y={bounds.y}
				width={period}
				height={period}
				sampling={CHECKER_SAMPLING}
			/>
		</Rect>
	);
}

// What the editor's canvas and the crop tool's both draw.

/** The canvas's fill, or a checkerboard where it's transparent. */
export function CanvasBackground({
	bounds,
	background,
	viewScale,
}: {
	bounds: SkRect;
	background: string | null;
	// Screen pixels per unit of `bounds`.
	viewScale: number;
}) {
	if (background === null) {
		return <Checkerboard bounds={bounds} cell={CHECKER_CELL / viewScale} />;
	}
	return <Rect rect={bounds} color={background} />;
}
