import { Paragraph, Path } from "react-native-skia";
import type { TextLayer } from "./text";
import { layoutTextLayer } from "./textLayerLayout";

/**
 * Draws a text layer in its own space, centered on the origin. Callers
 * position it with the layer's transform, and the screen fit is applied
 * above that, so this never deals with screen coordinates.
 */
export function TextLayerView({ layer }: { layer: TextLayer }) {
	const { background, outline, fill, width, height } = layoutTextLayer(layer);
	return (
		<>
			{background && layer.backgroundColor && (
				<Path path={background} color={layer.backgroundColor} />
			)}
			{outline && (
				<Paragraph
					paragraph={outline}
					x={-width / 2}
					y={-height / 2}
					width={width}
				/>
			)}
			<Paragraph
				paragraph={fill}
				x={-width / 2}
				y={-height / 2}
				width={width}
			/>
		</>
	);
}
