import {
	Canvas,
	Fill,
	Group,
	Path,
	Skia,
	type SkRect,
} from "@shopify/react-native-skia";
import { useCallback, useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
	type DerivedValue,
	type SharedValue,
	useDerivedValue,
} from "react-native-reanimated";
import { toTransformList } from "@/layers/layerTransform";
import type { EditorDocument, Layer } from "@/model/document";
import {
	type FramingAnchor,
	type PhotoPlacement,
	rebaseTransform,
} from "@/model/framing";
import type { Size } from "@/model/geometry";
import { colors } from "@/theme";
import { type CanvasCursor, cursorStyle } from "../canvasCursor";
import { CanvasBackground, LayerContent } from "../EditorSceneParts";
import type { DocumentViewport } from "../viewport";
import type { CropHandle } from "./cropDrag";
import { type CropState, cropAngle } from "./cropGeometry";
import { useCropGesture } from "./useCropGesture";

// In screen pixels.
const FRAME_STROKE_PX = 1;
const HANDLE_STROKE_PX = 3;
const HANDLE_LENGTH_PX = 18;

const CURSORS: Record<CropHandle, CanvasCursor> = {
	"top-left": "nwse-resize",
	"bottom-right": "nwse-resize",
	"top-right": "nesw-resize",
	"bottom-left": "nesw-resize",
	left: "ew-resize",
	right: "ew-resize",
	top: "ns-resize",
	bottom: "ns-resize",
	move: "move",
};

type CropCanvasProps = {
	document: EditorDocument;
	anchor: FramingAnchor;
	crop: SharedValue<CropState>;
	viewport: DerivedValue<DocumentViewport>;
	ratio: SharedValue<number | null>;
	dragging: SharedValue<boolean>;
	// What's on screen, in crop space, and screen pixels per crop unit, once
	// the view has settled: the checkerboard is drawn for these.
	visible: SkRect;
	viewScale: number;
	background: string | null;
	turnLayers: boolean;
	onLayout: (size: Size) => void;
	onDragEnd: () => void;
};

/**
 * The crop tool's canvas: the photo in crop space, turned and flipped as
 * it'll be, with the document's other layers where they'll land. Outside the
 * box is dimmed; inside it shows the canvas's background where the photo
 * doesn't reach. With no locked photo, nothing is drawn for the anchor.
 */
export function CropCanvas({
	document,
	anchor,
	crop,
	viewport,
	ratio,
	dragging,
	visible,
	viewScale,
	background,
	turnLayers,
	onLayout,
	onDragEnd,
}: CropCanvasProps) {
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [cursor, setCursor] = useState<CanvasCursor>("default");
	const photoSize = useMemo(
		() => ({ width: anchor.width, height: anchor.height }),
		[anchor.width, anchor.height],
	);

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
		onLayout({ width, height });
	};

	const handleHover = useCallback(
		(handle: CropHandle | null) =>
			setCursor(handle === null ? "default" : CURSORS[handle]),
		[],
	);

	const gesture = useCropGesture({
		crop,
		viewport,
		viewSize: size,
		photo: photoSize,
		ratio,
		dragging,
		onEnd: onDragEnd,
		onHover: handleHover,
	});

	const viewTransform = useDerivedValue(() => {
		const { scale, offsetX, offsetY } = viewport.value;
		return [{ translateX: offsetX }, { translateY: offsetY }, { scale }];
	});
	const box = useDerivedValue(() => {
		const { x, y, width, height } = crop.value.box;
		return Skia.XYWHRect(x, y, width, height);
	});
	// Mirrored here rather than by the layer, since flipping doesn't render.
	const photoTransform = useDerivedValue(() => [
		{ rotate: cropAngle(crop.value) },
		{ scaleX: crop.value.flipped ? -1 : 1 },
	]);
	const photo = anchor.layer;
	const unflipped = useMemo(
		() => photo && { ...photo, flipped: false },
		[photo],
	);
	const handleImageError = useCallback((error: unknown) => {
		console.warn("Couldn't load an image layer", error);
	}, []);

	return (
		<GestureDetector gesture={gesture}>
			<View
				style={[styles.container, cursorStyle(cursor)]}
				onLayout={handleLayout}
			>
				{/* Drawn once the view has a size: on web, Skia can miss redraws
				    asked for while its surface is still being set up. */}
				<Canvas style={styles.canvas}>
					{viewScale > 0 && (
						<Group transform={viewTransform}>
							<Group clip={box}>
								<CanvasBackground
									bounds={visible}
									background={background}
									viewScale={viewScale}
								/>
							</Group>
							{unflipped && (
								<Group transform={photoTransform}>
									<LayerContent
										layer={unflipped}
										onImageError={handleImageError}
									/>
								</Group>
							)}
							{document.layers.map((layer) =>
								layer === photo || layer.hidden ? null : (
									<CropLayer
										key={layer.id}
										layer={layer}
										anchor={anchor}
										crop={crop}
										turn={turnLayers}
										onImageError={handleImageError}
									/>
								),
							)}
							<Group clip={box} invertClip>
								<Fill color={colors.scrim} />
							</Group>
							<CropFrame crop={crop} viewport={viewport} dragging={dragging} />
						</Group>
					)}
				</Canvas>
			</View>
		</GestureDetector>
	);
}

/**
 * A layer where it'll land once the crop is applied: `rebaseTransform` into
 * crop space, where the anchor sits at the origin at one unit per pixel.
 */
function CropLayer({
	layer,
	anchor,
	crop,
	turn,
	onImageError,
}: {
	layer: Layer;
	anchor: PhotoPlacement;
	crop: SharedValue<CropState>;
	turn: boolean;
	onImageError: (error: unknown) => void;
}) {
	const from = useMemo(
		() => ({ transform: anchor.transform, flipped: anchor.flipped }),
		[anchor.transform, anchor.flipped],
	);
	const transform = useDerivedValue(() => {
		const to = {
			transform: {
				x: 0,
				y: 0,
				scaleX: 1,
				scaleY: 1,
				rotation: cropAngle(crop.value),
			},
			flipped: crop.value.flipped,
		};
		return toTransformList(rebaseTransform(layer.transform, from, to, turn));
	}, [layer.transform, from, turn]);

	return (
		<Group transform={transform}>
			<LayerContent layer={layer} onImageError={onImageError} />
		</Group>
	);
}

/**
 * The box's outline, its thirds while it's dragged, and bold corners and
 * side marks to grab. Line widths are in screen pixels.
 */
function CropFrame({
	crop,
	viewport,
	dragging,
}: {
	crop: SharedValue<CropState>;
	viewport: DerivedValue<DocumentViewport>;
	dragging: SharedValue<boolean>;
}) {
	const scale = useDerivedValue(() => viewport.value.scale);
	const paths = useDerivedValue(() => {
		const { x, y, width, height } = crop.value.box;
		const right = x + width;
		const bottom = y + height;
		const frame = Skia.PathBuilder.Make();
		frame.addRect(Skia.XYWHRect(x, y, width, height));
		if (dragging.value) {
			for (const third of [1 / 3, 2 / 3]) {
				frame.moveTo(x + width * third, y);
				frame.lineTo(x + width * third, bottom);
				frame.moveTo(x, y + height * third);
				frame.lineTo(right, y + height * third);
			}
		}

		const handles = Skia.PathBuilder.Make();
		const length = Math.min(
			HANDLE_LENGTH_PX / scale.value,
			width / 3,
			height / 3,
		);
		for (const [cx, cy, sx, sy] of [
			[x, y, 1, 1],
			[right, y, -1, 1],
			[right, bottom, -1, -1],
			[x, bottom, 1, -1],
		]) {
			handles.moveTo(cx, cy + sy * length);
			handles.lineTo(cx, cy);
			handles.lineTo(cx + sx * length, cy);
		}
		const middleX = x + width / 2;
		const middleY = y + height / 2;
		handles.moveTo(middleX - length / 2, y);
		handles.lineTo(middleX + length / 2, y);
		handles.moveTo(middleX - length / 2, bottom);
		handles.lineTo(middleX + length / 2, bottom);
		handles.moveTo(x, middleY - length / 2);
		handles.lineTo(x, middleY + length / 2);
		handles.moveTo(right, middleY - length / 2);
		handles.lineTo(right, middleY + length / 2);
		return { frame: frame.build(), handles: handles.build() };
	});
	const frame = useDerivedValue(() => paths.value.frame);
	const handles = useDerivedValue(() => paths.value.handles);
	const frameWidth = useDerivedValue(() => FRAME_STROKE_PX / scale.value);
	const handleWidth = useDerivedValue(() => HANDLE_STROKE_PX / scale.value);

	return (
		<>
			<Path
				path={frame}
				color="rgba(255, 255, 255, 0.8)"
				style="stroke"
				strokeWidth={frameWidth}
			/>
			<Path
				path={handles}
				color="#FFFFFF"
				style="stroke"
				strokeWidth={handleWidth}
				strokeCap="square"
			/>
		</>
	);
}

const styles = StyleSheet.create({
	// The editor's well, so the photo doesn't jump in shade entering the tool.
	container: {
		flex: 1,
		backgroundColor: colors.canvasWell,
	},
	canvas: {
		flex: 1,
	},
});
