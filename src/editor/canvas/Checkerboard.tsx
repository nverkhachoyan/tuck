import { useMemo } from "react";
import { Group, Path, Rect, rect, Skia, type SkRect } from "react-native-skia";
import { CHECKER_CELL, colors } from "@/ui/theme";

// Past this many squares, they're drawn bigger instead.
const MAX_CELLS = 20_000;

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
	const { x, y, width, height } = bounds;
	const squares = useMemo(() => {
		const count = (width / cell) * (height / cell);
		const side = count > MAX_CELLS ? cell * Math.sqrt(count / MAX_CELLS) : cell;
		const builder = Skia.PathBuilder.Make();
		for (let row = 0; row * side < height; row++) {
			for (let column = row % 2; column * side < width; column += 2) {
				builder.addRect(
					Skia.XYWHRect(x + column * side, y + row * side, side, side),
				);
			}
		}
		return builder.build();
	}, [x, y, width, height, cell]);

	return (
		<Group clip={rect(x, y, width, height)}>
			<Rect
				x={x}
				y={y}
				width={width}
				height={height}
				color={colors.checkerDark}
			/>
			<Path path={squares} color={colors.checkerLight} />
		</Group>
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
