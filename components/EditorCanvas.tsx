import {
	Canvas,
	Image as SkiaImage,
	Rect as SkiaRect,
	Text as SkiaText,
	matchFont,
	useImage,
} from "@shopify/react-native-skia";
import { useState } from "react";
import {
	type LayoutChangeEvent,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import { colors } from "./theme";
import type { EditorDocument, ImageLayer, TextLayer } from "../lib/editor-document";

const TEXT_HIT_PADDING = 14;

/**
 * Renders an EditorDocument fitted to the available space, mapping the
 * document's fixed logical dimensions onto the container's screen size.
 * Document-space coordinates stay independent of screen size so the same
 * layer positions can later drive full-resolution export.
 */
export function EditorCanvas({
	document,
	selectedLayerId = null,
	onSelectLayer,
}: {
	document: EditorDocument;
	selectedLayerId?: string | null;
	onSelectLayer?: (id: string | null) => void;
}) {
	const [size, setSize] = useState({ width: 0, height: 0 });

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
	};

	const scale =
		size.width > 0 && size.height > 0
			? Math.min(size.width / document.width, size.height / document.height)
			: 0;
	const renderWidth = document.width * scale;
	const renderHeight = document.height * scale;
	const offsetX = (size.width - renderWidth) / 2;
	const offsetY = (size.height - renderHeight) / 2;

	return (
		<Pressable
			style={styles.container}
			onLayout={handleLayout}
			onPress={() => onSelectLayer?.(null)}
		>
			<Canvas style={styles.canvas}>
				{scale > 0 &&
					document.layers.map((layer) => {
						switch (layer.type) {
							case "image":
								return (
									<ImageLayerNode
										key={layer.id}
										layer={layer}
										x={offsetX}
										y={offsetY}
										width={renderWidth}
										height={renderHeight}
									/>
								);
							case "text":
								return (
									<TextLayerNode
										key={layer.id}
										layer={layer}
										scale={scale}
										offsetX={offsetX}
										offsetY={offsetY}
										selected={layer.id === selectedLayerId}
									/>
								);
							default:
								return null;
						}
					})}
			</Canvas>

			{scale > 0 &&
				onSelectLayer &&
				document.layers.map((layer) =>
					layer.type === "text" ? (
						<TextLayerHitArea
							key={layer.id}
							layer={layer}
							scale={scale}
							offsetX={offsetX}
							offsetY={offsetY}
							onPress={() => onSelectLayer(layer.id)}
						/>
					) : null,
				)}
		</Pressable>
	);
}

function ImageLayerNode({
	layer,
	x,
	y,
	width,
	height,
}: {
	layer: ImageLayer;
	x: number;
	y: number;
	width: number;
	height: number;
}) {
	const image = useImage(layer.uri);
	if (!image) return null;
	return <SkiaImage image={image} x={x} y={y} width={width} height={height} fit="fill" />;
}

function measureTextLayer(
	layer: TextLayer,
	scale: number,
	offsetX: number,
	offsetY: number,
) {
	const fontSize = layer.fontSize * scale;
	const font = matchFont({ fontFamily: "System", fontWeight: "bold", fontSize });
	const bounds = font.measureText(layer.text || " ");
	const centerX = offsetX + layer.transform.x * scale;
	const centerY = offsetY + layer.transform.y * scale;
	const drawX = centerX - bounds.width / 2;
	const baselineY = centerY + fontSize * 0.35;
	return {
		font,
		fontSize,
		drawX,
		baselineY,
		boxX: drawX - TEXT_HIT_PADDING,
		boxY: centerY - fontSize / 2 - TEXT_HIT_PADDING,
		boxWidth: bounds.width + TEXT_HIT_PADDING * 2,
		boxHeight: fontSize + TEXT_HIT_PADDING * 2,
	};
}

function TextLayerNode({
	layer,
	scale,
	offsetX,
	offsetY,
	selected,
}: {
	layer: TextLayer;
	scale: number;
	offsetX: number;
	offsetY: number;
	selected: boolean;
}) {
	const { font, fontSize, drawX, baselineY, boxX, boxY, boxWidth, boxHeight } =
		measureTextLayer(layer, scale, offsetX, offsetY);
	if (!font) return null;

	const strokeWidth = Math.max(2, fontSize * 0.12);

	return (
		<>
			{selected && (
				<SkiaRect
					x={boxX}
					y={boxY}
					width={boxWidth}
					height={boxHeight}
					color={colors.accent}
					style="stroke"
					strokeWidth={1.5}
				/>
			)}
			<SkiaText
				x={drawX}
				y={baselineY}
				text={layer.text}
				font={font}
				color={layer.outlineColor}
				style="stroke"
				strokeWidth={strokeWidth}
				strokeJoin="round"
			/>
			<SkiaText x={drawX} y={baselineY} text={layer.text} font={font} color={layer.color} />
		</>
	);
}

function TextLayerHitArea({
	layer,
	scale,
	offsetX,
	offsetY,
	onPress,
}: {
	layer: TextLayer;
	scale: number;
	offsetX: number;
	offsetY: number;
	onPress: () => void;
}) {
	const { boxX, boxY, boxWidth, boxHeight } = measureTextLayer(
		layer,
		scale,
		offsetX,
		offsetY,
	);
	return (
		<Pressable
			onPress={onPress}
			style={{
				position: "absolute",
				left: boxX,
				top: boxY,
				width: boxWidth,
				height: boxHeight,
			}}
		/>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
});
