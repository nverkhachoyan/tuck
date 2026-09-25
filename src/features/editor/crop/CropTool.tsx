import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useEffect } from "react";
import {
	BackHandler,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EditorDocument } from "@/model/document";
import type { Framing } from "@/model/framing";
import { colors, HEADER_HEIGHT, webTransition } from "@/theme";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { Button } from "@/ui/Button";
import { CanvasStage } from "@/ui/CanvasStage";
import { interaction } from "@/ui/interaction";
import { TextButton } from "@/ui/TextButton";
import { AngleDial } from "./AngleDial";
import { CropCanvas } from "./CropCanvas";
import { MAX_STRAIGHTEN } from "./cropGeometry";
import { ASPECTS, useCropController } from "./useCropController";

type CropToolProps = {
	document: EditorDocument;
	onCancel: () => void;
	// Gets the document's new framing, and whether other layers turn with
	// the photo; an untouched crop gives back the current one.
	onDone: (framing: Framing, turnLayers: boolean) => void;
};

/**
 * Crops, turns, flips, and straightens the photo (the lowest locked one, see
 * `framingAnchor`), and sizes and fills the canvas around it, over the editor
 * until Done or Cancel. The box is the canvas-to-be: dragging it past the
 * photo's edges expands the canvas. With no locked photo, the canvas itself
 * is cropped and turned, and its layers with it.
 * Nothing changes in the document until Done, which is one undo step.
 */
export function CropTool({ document, onCancel, onDone }: CropToolProps) {
	const controller = useCropController(document, onDone);
	const { anchor, aspect, background, turnLayers } = controller;
	const { bottom } = useSafeAreaInsets();
	const hasOtherLayers = document.layers.some(
		(layer) => layer !== anchor.layer && !layer.hidden,
	);
	const onlyText = document.layers.every(
		(layer) => layer === anchor.layer || layer.type === "text",
	);

	// Android's back button cancels, as it would a dialog.
	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				onCancel();
				return true;
			},
		);
		return () => subscription.remove();
	}, [onCancel]);

	// Return applies from the canvas, while controls keep their normal keyboard
	// behavior. Escape cancels from anywhere in the tool.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Enter" && !isInteractiveElement(event.target)) {
				controller.done();
			} else if (event.key === "Escape") onCancel();
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TextButton label="Cancel" onPress={onCancel} />
				{controller.changed && (
					<View style={styles.reset}>
						<TextButton label="Reset" onPress={controller.reset} />
					</View>
				)}
				<Button
					label="Done"
					variant="primary"
					size="small"
					onPress={controller.done}
				/>
			</View>

			<CanvasStage>
				<CropCanvas
					document={document}
					anchor={anchor}
					crop={controller.crop}
					viewport={controller.viewport}
					ratio={controller.ratio}
					dragging={controller.dragging}
					visible={controller.visible}
					viewScale={controller.viewScale}
					background={background}
					turnLayers={turnLayers}
					onLayout={controller.setViewSize}
					onDragEnd={controller.settle}
				/>
			</CanvasStage>

			<View style={[styles.panel, { paddingBottom: 12 + bottom }]}>
				{/* Levels a tilted photo; a canvas alone has nothing to level. */}
				{anchor.layer && (
					<AngleDial
						value={controller.straighten}
						max={MAX_STRAIGHTEN}
						label="Straighten"
						onBegin={controller.straightenBegin}
						onChange={controller.straightenChange}
						onEnd={controller.straightenEnd}
					/>
				)}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.aspects}
				>
					{ASPECTS.map(({ id, label }) => {
						const selected = id === aspect;
						return (
							<Pressable
								key={id}
								hitSlop={4}
								onPress={() => controller.pickAspect(id)}
								accessibilityRole="button"
								accessibilityLabel={`Aspect ratio ${label}`}
								accessibilityState={{ selected }}
								style={styles.target}
							>
								{(state) => {
									const { pressed, hovered } = interaction(state);
									return (
										<View
											style={[
												styles.chip,
												webTransition,
												hovered && styles.chipHovered,
												selected && styles.chipSelected,
												pressed && styles.chipPressed,
											]}
										>
											<Text
												style={[
													styles.chipLabel,
													selected && styles.chipLabelSelected,
												]}
											>
												{label}
											</Text>
										</View>
									);
								}}
							</Pressable>
						);
					})}
				</ScrollView>
				<View style={styles.actions}>
					<ActionButton
						icon="rotate-left"
						label="Rotate"
						onPress={controller.rotate}
					/>
					<ActionButton
						icon="flip-horizontal"
						label="Flip"
						onPress={controller.flip}
					/>
					{hasOtherLayers && (
						<ActionButton
							icon="format-text-rotation-angle-up"
							label={onlyText ? "Turn text" : "Turn layers"}
							selected={turnLayers}
							onPress={controller.toggleTurnLayers}
						/>
					)}
				</View>
				<View style={styles.fill}>
					<Text style={styles.fillLabel}>Fill</Text>
					<BackgroundPicker
						value={background}
						onPick={controller.setBackground}
					/>
				</View>
			</View>
		</View>
	);
}

/** Whether a web key event belongs to a control that handles Enter itself. */
function isInteractiveElement(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest(
			'button, a, input, select, textarea, [role="button"], [role="slider"], [role="switch"], [contenteditable="true"]',
		) !== null
	);
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** An icon over a small label; `selected` shows a toggle that's on. */
function ActionButton({
	icon,
	label,
	selected,
	onPress,
}: {
	icon: IconName;
	label: string;
	selected?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={6}
			onPress={onPress}
			accessibilityRole={selected === undefined ? "button" : "switch"}
			accessibilityLabel={label}
			accessibilityState={
				selected === undefined ? undefined : { checked: selected }
			}
			style={styles.action}
		>
			{(state) => {
				const { pressed, hovered } = interaction(state);
				return (
					<>
						<View
							style={[
								styles.actionIcon,
								webTransition,
								hovered && styles.actionIconHovered,
								selected && styles.actionIconSelected,
								pressed && styles.actionIconPressed,
							]}
						>
							<MaterialCommunityIcons
								name={icon}
								size={22}
								color={colors.textPrimary}
							/>
						</View>
						<Text style={styles.actionLabel}>{label}</Text>
					</>
				);
			}}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	// Opaque, over the whole editor.
	container: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.background,
	},
	header: {
		height: HEADER_HEIGHT,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
	},
	// Centered on the whole bar, whatever the buttons beside it measure.
	reset: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		pointerEvents: "box-none",
	},
	panel: {
		gap: 4,
		paddingTop: 8,
	},
	aspects: {
		gap: 8,
		paddingHorizontal: 16,
	},
	target: {
		height: 44,
		justifyContent: "center",
	},
	chip: {
		height: 32,
		paddingHorizontal: 14,
		borderRadius: 16,
		backgroundColor: colors.glassControl,
		justifyContent: "center",
	},
	chipHovered: {
		backgroundColor: colors.glassControlHover,
	},
	chipSelected: {
		backgroundColor: colors.chosen,
	},
	chipPressed: {
		transform: [{ scale: 0.96 }],
	},
	chipLabel: {
		fontSize: 14,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	chipLabelSelected: {
		color: colors.onChosen,
		fontWeight: "600",
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 20,
		paddingHorizontal: 20,
	},
	action: {
		minWidth: 56,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	actionIcon: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	actionIconHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	actionIconSelected: {
		backgroundColor: colors.chosenSoft,
	},
	actionIconPressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	actionLabel: {
		fontSize: 11,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	// Its own row keeps the picker reachable beside all three actions on a
	// narrow phone.
	fill: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		paddingHorizontal: 20,
	},
	fillLabel: {
		fontSize: 13,
		color: colors.textSecondary,
	},
});
