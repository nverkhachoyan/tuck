import { StyleSheet, View } from "react-native";
import type { Brush } from "@/model/document";
import { RingChoice } from "@/ui/RingChoice";
import { ColorSwatches } from "../ColorSwatches";
import { ToolButton } from "../ToolButton";
import {
	SIZE_DOTS,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../ToolOptions";
import { type BrushSettings, brushSizeIndex } from "./brushSettings";

/**
 * The drawing tools, in place of the toolbar while drawing: the pen, the
 * eraser, and the brush's options, which open over the canvas. Tapping the
 * tool that's in use opens them too.
 */
export function DrawPanel({
	settings,
	optionsOpen,
	onChange,
	onToggleOptions,
}: {
	settings: BrushSettings;
	optionsOpen: boolean;
	onChange: (settings: BrushSettings) => void;
	onToggleOptions: () => void;
}) {
	const pickTool = (tool: Brush["type"]) => {
		if (tool === settings.tool) onToggleOptions();
		else onChange({ ...settings, tool });
	};
	const pen = settings.tool === "pen";
	return (
		<View style={styles.row}>
			<ToolButton
				label="Pen"
				icon="draw-pen"
				selected={pen}
				onPress={() => pickTool("pen")}
			/>
			<ToolButton
				label="Eraser"
				icon="eraser"
				selected={!pen}
				onPress={() => pickTool("eraser")}
			/>
			<ToolButton
				label={pen ? "Style" : "Size"}
				icon="palette-outline"
				glyph={
					<SizeDot
						size={SIZE_DOTS[brushSizeIndex(settings)]}
						color={pen ? settings.color : null}
					/>
				}
				selected={optionsOpen}
				onPress={onToggleOptions}
			/>
		</View>
	);
}

/**
 * The brush's color and size, in a card over the canvas (see `ToolOptions`).
 */
export function BrushOptions({
	settings,
	bottomInset,
	onChange,
	onClose,
}: {
	settings: BrushSettings;
	bottomInset: number;
	onChange: (settings: BrushSettings) => void;
	onClose: () => void;
}) {
	const pen = settings.tool === "pen";
	const pickSize = (size: number) =>
		onChange(
			pen ? { ...settings, penSize: size } : { ...settings, eraserSize: size },
		);
	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			onClose={onClose}
		>
			{pen && (
				<ToolOption label="Color">
					<ColorSwatches
						value={settings.color}
						onPick={(color) => color && onChange({ ...settings, color })}
					/>
				</ToolOption>
			)}
			<ToolOption label="Size">
				<ToolChoices>
					{SIZE_DOTS.map((dot, index) => (
						<RingChoice
							key={dot}
							label={`Size ${index + 1} of ${SIZE_DOTS.length}`}
							selected={index === brushSizeIndex(settings)}
							onPress={() => pickSize(index)}
						>
							<SizeDot size={dot} color={pen ? settings.color : null} />
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
		</ToolOptions>
	);
}

const styles = StyleSheet.create({
	// Like the toolbar it replaces.
	row: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 28,
		paddingHorizontal: 20,
	},
});
