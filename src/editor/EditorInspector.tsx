import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, type ViewInstance } from "react-native";
import { LayersPanel, type layerListProps } from "./layers/panel/LayersPanel";
import { Inspector } from "./shell/Dock";

/**
 * What the wide editor shows on the right when the window is tall enough, or
 * when Layers has it open: the layers list. While `layersInert`, the layers
 * can't be changed or reached.
 */
export function EditorInspector({
	layerList,
	layersInert = false,
}: {
	layerList: ReturnType<typeof layerListProps>;
	layersInert?: boolean;
}) {
	const layersRef = useRef<ViewInstance>(null);
	// React Native Web doesn't pass `inert` through.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const element = layersRef.current as unknown as HTMLElement | null;
		element?.toggleAttribute("inert", layersInert);
	}, [layersInert]);
	return (
		<Inspector>
			<View
				ref={layersRef}
				style={[styles.layers, layersInert && styles.inert]}
				accessibilityElementsHidden={layersInert}
				importantForAccessibility={layersInert ? "no-hide-descendants" : "auto"}
			>
				<LayersPanel {...layerList} layout="inspector" open />
			</View>
		</Inspector>
	);
}

const styles = StyleSheet.create({
	layers: {
		flexShrink: 1,
	},
	inert: {
		opacity: 0.4,
		pointerEvents: "none",
	},
});
