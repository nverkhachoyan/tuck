import { Canvas, Image, type SkImage } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useEditor } from "@/editor/state/EditorProvider";
import { renderDocument } from "@/export/renderDocument";
import { shareImage } from "@/export/shareImage";
import { Button } from "@/ui/Button";

export default function ExportRoute() {
	const { doc } = useEditor();
	const router = useRouter();
	const [result, setResult] = useState<SkImage | null>(null);
	const [busy, setBusy] = useState(false);
	const [size, setSize] = useState({ width: 0, height: 0 });

	// Free the previous render once it's been replaced (or on unmount).
	useEffect(() => () => result?.dispose(), [result]);

	// The stack guard unmounts this route once the document closes.
	if (!doc) return null;

	const handleLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		setSize({ width, height });
	};

	const run = async (task: () => Promise<void>, failureTitle: string) => {
		setBusy(true);
		try {
			await task();
		} catch (error) {
			Alert.alert(failureTitle, String(error));
		} finally {
			setBusy(false);
		}
	};

	const handleRender = () =>
		run(async () => setResult(await renderDocument(doc)), "Export failed");

	const handleShare = () =>
		run(async () => {
			if (!result) return;
			if (!(await shareImage(result))) {
				Alert.alert("Sharing unavailable", "This device can't share files.");
			}
		}, "Share failed");

	return (
		<View style={styles.container}>
			<Button label="Back" onPress={() => router.back()} />
			<Button
				label={result ? "Re-render" : "Export"}
				disabled={busy}
				onPress={handleRender}
			/>
			{result && (
				<Button
					label="Share / Save"
					variant="primary"
					disabled={busy}
					onPress={handleShare}
				/>
			)}
			{/* Canvas has no onLayout on Fabric, so measure a wrapper instead. */}
			<View style={styles.preview} onLayout={handleLayout}>
				<Canvas style={styles.preview}>
					{result && (
						<Image
							image={result}
							fit="contain"
							x={0}
							y={0}
							width={size.width}
							height={size.height}
						/>
					)}
				</Canvas>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	preview: {
		flex: 1,
	},
});
