import { Canvas } from "@shopify/react-native-skia";
import { useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet } from "react-native";
import type { EditorDocument } from "../../lib/editor-document";
import { ImageLayerNode } from "./ImageLayerNode";
import { TextLayerHitArea } from "./TextLayerHitArea";
import { TextLayerNode } from "./TextLayerNode";

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

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	canvas: {
		flex: 1,
	},
});
