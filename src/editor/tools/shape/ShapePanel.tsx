import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { RingChoice } from "@/ui/RingChoice";
import { colors, space } from "@/ui/theme";
import { useColorTarget, useEditorContext } from "../../editorContext";
import { type ShapeKind, shapeKinds } from "../../layers/shape/shape";
import {
	ColorChip,
	ColorOptions,
	ColorSwatchRow,
} from "../../shell/ColorOptions";
import { BarGroup, BarSections, OptionSegments } from "../../shell/ContextBar";
import { SHAPE_ICONS, SHAPE_NAMES } from "../../shell/shapeIcons";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SizeChip,
	SizeChoices,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import type { ShapeController } from "./useShapeTool";

/**
 * Shape options in the wide editor's header bar:
 * - Shape selector segments (Rectangle, Ellipse, Line, Arrow)
 * - Color swatch popover with custom color and eyedropper
 * - Stroke width selector
 */
export function ShapeBar({
	controller: { settings, change },
}: {
	controller: ShapeController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);

	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Shape"
					options={shapeKinds.map((kind) => ({
						title: SHAPE_NAMES[kind],
						icon: SHAPE_ICONS[kind],
					}))}
					selected={shapeKinds.indexOf(settings.shape)}
					onSelect={(index) => {
						const next = shapeKinds[index];
						if (next && next !== settings.shape) {
							change({ ...settings, shape: next });
						}
					}}
				/>
				<ColorChip
					label="Color"
					value={settings.color}
					customColor={customColor}
					onPick={(c) => c && change({ ...settings, color: c })}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
				<SizeChip
					index={settings.sizeIndex}
					color={settings.color}
					onPick={(sizeIndex) => change({ ...settings, sizeIndex })}
				/>
			</BarGroup>
		</BarSections>
	);
}

function ShapeStyleDock({
	controller: { settings, change },
}: {
	controller: ShapeController;
}) {
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);
	return (
		<View style={styles.dockColumn}>
			<View style={styles.dockRow}>
				<ToolChoices nowrap>
					{shapeKinds.map((shape) => (
						<RingChoice
							key={shape}
							variant="highlight"
							label={SHAPE_NAMES[shape]}
							selected={settings.shape === shape}
							onPress={() => change({ ...settings, shape })}
						>
							{(ink) => (
								<MaterialCommunityIcons
									name={SHAPE_ICONS[shape]}
									size={22}
									color={ink}
								/>
							)}
						</RingChoice>
					))}
				</ToolChoices>
				<View style={styles.dockRule} />
				<SizeChip
					index={settings.sizeIndex}
					color={settings.color}
					onPick={(sizeIndex) => change({ ...settings, sizeIndex })}
				/>
			</View>
			<View style={styles.dockRow}>
				<ColorSwatchRow
					value={settings.color}
					customColor={customColor}
					onPick={(color) => change({ ...settings, color })}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			</View>
		</View>
	);
}

function ActiveShapePanel({
	controller: { settings, change },
}: {
	controller: ShapeController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();

	const selectShape = (shape: ShapeKind) => {
		if (settings.shape === shape) {
			toggleTray();
		} else {
			change({ ...settings, shape });
		}
	};

	return (
		<ToolRow>
			{shapeKinds.map((shape) => (
				<ToolButton
					key={shape}
					label={SHAPE_NAMES[shape]}
					icon={SHAPE_ICONS[shape]}
					selected={settings.shape === shape}
					onPress={() => selectShape(shape)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<ColorGlyph color={settings.color} />}
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

/**
 * Dock buttons on phone:
 * - While drawing shapes: 4 shapes + Style button opening the shared tray.
 * - When a shape is selected: direct shape kind, size, and color controls.
 */
export function ShapePanel({ controller }: { controller: ShapeController }) {
	return controller.isStylingSelected ? (
		<ShapeStyleDock controller={controller} />
	) : (
		<ActiveShapePanel controller={controller} />
	);
}

/**
 * Tray rising above the phone dock with shape kind, color, and stroke width.
 */
export function ShapeTray({
	controller: { settings, change },
}: {
	controller: ShapeController;
}) {
	const { bottomInset, rightInset, closeTray } = useEditorContext();
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change({ ...settings, color }),
	);

	return (
		<ToolOptions
			closeLabel="Close shape options"
			bottomInset={bottomInset}
			rightInset={rightInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			<ToolOption label="Shape">
				<ToolChoices>
					{shapeKinds.map((shape) => (
						<RingChoice
							key={shape}
							variant="highlight"
							label={SHAPE_NAMES[shape]}
							selected={settings.shape === shape}
							onPress={() => change({ ...settings, shape })}
						>
							{(ink) => (
								<MaterialCommunityIcons
									name={SHAPE_ICONS[shape]}
									size={22}
									color={ink}
								/>
							)}
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
			<ToolOption label="Color">
				<ColorOptions
					value={settings.color}
					customColor={customColor}
					onPick={(c) => c && change({ ...settings, color: c })}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			</ToolOption>
			<ToolOption label="Size">
				<SizeChoices
					index={settings.sizeIndex}
					color={settings.color}
					onPick={(sizeIndex) => change({ ...settings, sizeIndex })}
				/>
			</ToolOption>
		</ToolOptions>
	);
}

function ColorGlyph({ color }: { color: string }) {
	return <View style={[styles.colorTile, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
	dockColumn: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: space.xs,
	},
	dockRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	dockRule: {
		width: 1,
		height: 24,
		marginHorizontal: 10,
		backgroundColor: colors.borderStrong,
	},
	colorTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
});
