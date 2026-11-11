import type { ReactNode } from "react";
import type { SkImage } from "react-native-skia";
import { assertNever } from "../document/assertNever";
import { DrawingLayerView } from "../layers/drawing/DrawingLayerView";
import type { ColorMatrix } from "../layers/image/adjustments";
import { ImageLayerView } from "../layers/image/ImageLayerView";
import { canDrawCut } from "../layers/image/mask";
import type { Layer } from "../layers/layer";
import { RedactionLayerView } from "../layers/redaction/RedactionLayerView";
import { ShapeLayerView } from "../layers/shape/ShapeLayerView";
import { TextLayerView } from "../layers/text/TextLayerView";

/**
 * A layer's content drawn in its own space with images already resolved.
 * Export's scene hands its pre-decoded images directly; the interactive
 * canvas resolves them asynchronously with `useDecodedImage` before calling
 * this.
 */
export function LayerView({
	layer,
	image,
	mask,
	stroke,
	matrix,
	selectionColor,
	opacity,
	wrapStroke,
	liveInside,
}: {
	layer: Layer;
	image?: SkImage;
	mask?: SkImage;
	stroke?: ReactNode;
	opacity?: number;
	wrapStroke?: (index: number, stroke: ReactNode) => ReactNode;
	liveInside?: boolean;
	matrix?: { value: ColorMatrix };
	selectionColor?: string;
}) {
	switch (layer.type) {
		case "image":
			if (!image || !canDrawCut(layer, mask !== undefined, !!selectionColor)) {
				return null;
			}
			return (
				<ImageLayerView
					layer={layer}
					image={image}
					mask={mask}
					matrix={matrix}
					liveMask={stroke}
					selectionColor={selectionColor}
				/>
			);
		case "text":
			return <TextLayerView layer={layer} />;
		case "drawing":
			return (
				<DrawingLayerView
					layer={layer}
					opacity={opacity}
					wrapStroke={wrapStroke}
					liveInside={liveInside}
				>
					{stroke}
				</DrawingLayerView>
			);
		case "redaction":
			return <RedactionLayerView layer={layer} mask={mask} />;
		case "shape":
			return <ShapeLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}
