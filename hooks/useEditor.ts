import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
	createTextLayer,
	type EditorDocument,
	type TextLayer,
} from "../lib/editor-document";
import { pickPhotoDocument } from "../lib/pick-photo";

/**
 * Owns the editor's document + selection state and every mutation that acts
 * on them. Keeping this out of the screen components means the document
 * model can be reasoned about (and eventually tested) independent of React
 * Native rendering concerns.
 */
export function useEditor() {
	const [doc, setDoc] = useState<EditorDocument | null>(null);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

	const pickImage = useCallback(async () => {
		const result = await pickPhotoDocument();
		if (result.status === "picked") {
			setDoc(result.document);
		} else if (result.status === "permission-denied") {
			Alert.alert(
				"Permission required",
				"Permission to access the media library is required.",
			);
		}
	}, []);

	const closeDocument = useCallback(() => {
		setDoc(null);
		setSelectedLayerId(null);
	}, []);

	const addTextLayer = useCallback(() => {
		setDoc((current) => {
			if (!current) return current;
			const layer = createTextLayer(current);
			setSelectedLayerId(layer.id);
			return { ...current, layers: [...current.layers, layer] };
		});
	}, []);

	const updateSelectedLayer = useCallback(
		(patch: Partial<TextLayer>) => {
			if (!selectedLayerId) return;
			setDoc((current) => {
				if (!current) return current;
				return {
					...current,
					layers: current.layers.map((layer) =>
						layer.type === "text" && layer.id === selectedLayerId
							? { ...layer, ...patch }
							: layer,
					),
				};
			});
		},
		[selectedLayerId],
	);

	const deleteSelectedLayer = useCallback(() => {
		if (!selectedLayerId) return;
		setDoc((current) => {
			if (!current) return current;
			return {
				...current,
				layers: current.layers.filter((layer) => layer.id !== selectedLayerId),
			};
		});
		setSelectedLayerId(null);
	}, [selectedLayerId]);

	const deselectLayer = useCallback(() => setSelectedLayerId(null), []);

	const selectedLayer = useMemo(
		() =>
			doc?.layers.find(
				(layer): layer is TextLayer =>
					layer.type === "text" && layer.id === selectedLayerId,
			),
		[doc, selectedLayerId],
	);

	return {
		doc,
		selectedLayer,
		pickImage,
		closeDocument,
		addTextLayer,
		updateSelectedLayer,
		deleteSelectedLayer,
		selectLayer: setSelectedLayerId,
		deselectLayer,
	};
}
