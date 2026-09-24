import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BackgroundPicker } from "@/editor/BackgroundPicker";
import { createBlankDocument } from "@/model/document";
import { createBlankProject } from "@/projects/projects";
import { useStore } from "@/store";
import { colors } from "@/theme";
import { ScreenHeader } from "@/ui/ScreenHeader";

// Common sizes for posts and stories. The crop tool reshapes a canvas later.
const PRESETS = [
	{ name: "Square", width: 1080, height: 1080 },
	{ name: "Portrait", width: 1080, height: 1350 },
	{ name: "Story", width: 1080, height: 1920 },
	{ name: "Landscape", width: 1920, height: 1080 },
] as const;
type Preset = (typeof PRESETS)[number];

// The longer side of a preset's preview, and a transparency square's side.
const PREVIEW_SIZE = 88;
const CHECKER_CELL = 11;

/** Starts an empty canvas at a picked size and fill. */
export default function CreateRoute() {
	const openDocument = useStore((state) => state.openDocument);
	const router = useRouter();
	const [background, setBackground] = useState<string | null>("#FFFFFF");
	const [busy, setBusy] = useState(false);
	// Set at once, so a second tap can't start another project meanwhile.
	const creating = useRef(false);

	const handleCreate = async ({ width, height }: Preset) => {
		// An editor whose save failed is still open until the welcome screen
		// closes it.
		if (creating.current || useStore.getState().document) return;
		creating.current = true;
		setBusy(true);
		try {
			// Without storage, the canvas can still be edited, just not kept.
			const opened = await createBlankProject({
				width,
				height,
				background,
			}).catch((error: unknown) => {
				console.warn("Couldn't save the canvas as a project", error);
				return {
					id: null,
					document: createBlankDocument(width, height, background),
				};
			});
			openDocument(opened.document, opened.id);
			// Back from the editor goes to the welcome screen, which closes it.
			router.replace("/editor");
		} finally {
			creating.current = false;
			setBusy(false);
		}
	};

	return (
		<View style={styles.screen}>
			<ScreenHeader title="New Canvas" onBack={() => router.back()} />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.fill}>
					<Text style={styles.fillLabel}>Fill</Text>
					<BackgroundPicker value={background} onPick={setBackground} />
				</View>
				<View style={styles.grid}>
					{PRESETS.map((preset) => (
						<PresetTile
							key={preset.name}
							preset={preset}
							background={background}
							disabled={busy}
							onPress={() => void handleCreate(preset)}
						/>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

function PresetTile({
	preset,
	background,
	disabled,
	onPress,
}: {
	preset: Preset;
	background: string | null;
	disabled: boolean;
	onPress: () => void;
}) {
	const { name, width, height } = preset;
	const scale = PREVIEW_SIZE / Math.max(width, height);
	const size = { width: width * scale, height: height * scale };
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${width} by ${height}`}
			style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
		>
			<View style={styles.previewArea}>
				<View
					style={[
						styles.preview,
						size,
						background !== null && { backgroundColor: background },
					]}
				>
					{background === null && <Checker {...size} />}
				</View>
			</View>
			<Text style={styles.name}>{name}</Text>
			<Text style={styles.size}>
				{width} × {height}
			</Text>
		</Pressable>
	);
}

/** The checkerboard that stands for transparency, in plain views. */
function Checker({ width, height }: { width: number; height: number }) {
	const rows = Math.ceil(height / CHECKER_CELL);
	const columns = Math.ceil(width / CHECKER_CELL);
	return (
		<View style={styles.checker}>
			{Array.from({ length: rows }, (_, row) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid
				<View key={row} style={styles.checkerRow}>
					{Array.from({ length: columns }, (_, column) => (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid
							key={column}
							style={[
								styles.cell,
								(row + column) % 2 === 1 && styles.cellLight,
							]}
						/>
					))}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	// A phone-width column, like the welcome screen's.
	content: {
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
		gap: 16,
		padding: 24,
	},
	fill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	fillLabel: {
		fontSize: 15,
		color: colors.textPrimary,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	tile: {
		flexBasis: "40%",
		flexGrow: 1,
		alignItems: "center",
		gap: 4,
		paddingVertical: 16,
		paddingHorizontal: 12,
		borderRadius: 16,
		backgroundColor: colors.surface,
	},
	pressed: {
		opacity: 0.7,
	},
	previewArea: {
		width: PREVIEW_SIZE,
		height: PREVIEW_SIZE,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 8,
	},
	preview: {
		borderRadius: 4,
		borderWidth: 1,
		borderColor: colors.border,
		overflow: "hidden",
	},
	name: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	size: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	checker: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.checkerDark,
	},
	checkerRow: {
		flexDirection: "row",
	},
	cell: {
		width: CHECKER_CELL,
		height: CHECKER_CELL,
	},
	cellLight: {
		backgroundColor: colors.checkerLight,
	},
});
