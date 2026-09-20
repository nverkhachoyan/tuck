import { Canvas, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import type { EditorDocument, ImageLayer } from "../lib/editor-document";

/**
 * Renders an EditorDocument fitted to the available space, mapping the
 * document's fixed logical dimensions onto the container's screen size.
 * Document-space coordinates stay independent of screen size so the same
 * layer positions can later drive full-resolution export.
 */
export function EditorCanvas({ document }: { document: EditorDocument }) {
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
		<View style={styles.container} onLayout={handleLayout}>
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
							default:
								return null;
						}
					})}
			</Canvas>
		</View>
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
});
