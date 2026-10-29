import { Path, Skia } from "react-native-skia";
import type { TextRect } from "./caretLayout.ts";

/**
 * A text selection's boxes, from `CaretLayout.selectionRects`, filled as one
 * path so neighboring lines' boxes don't darken where they meet. Draw it over
 * the text, where an opaque box would hide it, so the default is see-through.
 */
export function SelectionHighlight({
	rects,
	color = "rgba(88, 166, 255, 0.4)",
}: {
	rects: readonly TextRect[];
	color?: string;
}) {
	const builder = Skia.PathBuilder.Make();
	for (const { x, y, width, height } of rects) {
		builder.addRect(Skia.XYWHRect(x, y, width, height));
	}
	return <Path path={builder.build()} color={color} />;
}
