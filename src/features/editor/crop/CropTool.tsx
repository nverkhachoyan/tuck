import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useEffect, useState } from "react";
import {
	BackHandler,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { EditorDocument } from "@/model/document";
import type { Framing } from "@/model/framing";
import {
	chosenOutline,
	colors,
	radii,
	typography,
	webTransition,
} from "@/theme";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { CanvasStage } from "@/ui/CanvasStage";
import { interaction } from "@/ui/interaction";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { Dial, type DialScale } from "../Dial";
import { Dock, DockFooter, useDockInset } from "../Dock";
import { ToolButton, ToolRow } from "../ToolButton";
import { CropCanvas } from "./CropCanvas";
import { MAX_STRAIGHTEN } from "./cropGeometry";
import { ASPECTS, useCropController } from "./useCropController";

type CropTab = "crop" | "rotate" | "canvas";

// A degree a step, a long tick every 15, settling level from a degree away.
const DEGREES: DialScale = {
	step: Math.PI / 180,
	pxPerStep: 8,
	tickEvery: 1,
	majorEvery: 15,
	snap: 1,
};

const TABS: { tab: CropTab; label: string; icon: IconName }[] = [
	{ tab: "crop", label: "Crop", icon: "crop" },
	{ tab: "rotate", label: "Rotate", icon: "format-rotate-90" },
	{ tab: "canvas", label: "Canvas", icon: "checkerboard" },
];

// Room for the tallest tab's controls, so the canvas holds still as tabs
// change: Rotate's dial over its actions, or the actions alone when there's
// no photo to level.
const CONTROLS_WITH_DIAL = 120;
const CONTROLS_WITHOUT_DIAL = 64;
const TAB_IN = FadeIn.duration(160);

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
 * Cancel and Done are beside the dock, where its tabs are picked; each tab's
 * controls show just above it. Its header covers the editor's.
 */
export function CropTool({ document, onCancel, onDone }: CropToolProps) {
	const controller = useCropController(document, onDone);
	const { anchor, aspect, background, turnLayers } = controller;
	const dockInset = useDockInset();
	const [tab, setTab] = useState<CropTab>("crop");
	// Redactions always turn with the photo (see `turnsWithPhoto`), so they
	// have no say in whether the choice shows, or what it's called.
	const choosable = document.layers.filter(
		(layer) => layer !== anchor.layer && layer.type !== "redaction",
	);
	const hasOtherLayers = choosable.some((layer) => !layer.hidden);
	const onlyText = choosable.every((layer) => layer.type === "text");

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
			{/* As tall as the editor's header, so the canvas keeps its place. */}
			<ScreenHeader
				action={
					controller.changed && (
						<TextButton label="Reset" onPress={controller.reset} />
					)
				}
			/>

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

			<View
				style={[
					styles.controls,
					{
						height: anchor.layer ? CONTROLS_WITH_DIAL : CONTROLS_WITHOUT_DIAL,
						marginBottom: dockInset,
					},
				]}
			>
				<Animated.View key={tab} entering={TAB_IN} style={styles.tab}>
					{tab === "crop" ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.aspects}
						>
							{ASPECTS.map(({ id, label }) => (
								<AspectChip
									key={id}
									label={label}
									selected={id === aspect}
									onPress={() => controller.pickAspect(id)}
								/>
							))}
						</ScrollView>
					) : tab === "rotate" ? (
						<>
							{/* Levels a tilted photo; a canvas alone has nothing to level. */}
							{anchor.layer && (
								<Dial
									value={controller.straighten}
									max={MAX_STRAIGHTEN}
									scale={DEGREES}
									label="Straighten"
									increaseLabel="Increase angle"
									decreaseLabel="Decrease angle"
									readout={(degrees) => `${degrees}°`}
									valueText={(degrees) => `${degrees} degrees`}
									onBegin={controller.straightenBegin}
									onChange={controller.straightenChange}
									onEnd={controller.straightenEnd}
								/>
							)}
							<View style={styles.actions}>
								<ActionButton
									icon="rotate-left"
									label="Rotate 90°"
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
						</>
					) : (
						<View style={styles.fill}>
							<Text style={styles.fillLabel}>Fill</Text>
							<BackgroundPicker
								value={background}
								onPick={controller.setBackground}
							/>
						</View>
					)}
				</Animated.View>
			</View>

			<Dock
				panel="crop"
				footer={
					<DockFooter
						title="Crop"
						onCancel={onCancel}
						cancelShortcut="Escape"
						onDone={controller.done}
						doneShortcut="Enter"
					/>
				}
			>
				<ToolRow>
					{TABS.map(({ tab: value, label, icon }) => (
						<ToolButton
							key={value}
							label={label}
							icon={icon}
							selected={tab === value}
							onPress={() => setTab(value)}
						/>
					))}
				</ToolRow>
			</Dock>
		</View>
	);
}

/** An aspect ratio to hold the box to. */
function AspectChip({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={4}
			onPress={onPress}
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
							style={[styles.chipLabel, selected && styles.chipLabelSelected]}
						>
							{label}
						</Text>
					</View>
				);
			}}
		</Pressable>
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
	// Each tab's controls sit on the dock, over any room they don't need.
	controls: {
		justifyContent: "flex-end",
		paddingBottom: 8,
	},
	tab: {
		gap: 4,
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
		paddingHorizontal: 12,
		borderRadius: radii.small,
		justifyContent: "center",
	},
	chipHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	chipSelected: chosenOutline,
	chipPressed: {
		transform: [{ scale: 0.96 }],
	},
	chipLabel: {
		...typography.label,
		fontVariant: ["tabular-nums"],
		color: colors.textSecondary,
	},
	chipLabelSelected: {
		color: colors.textPrimary,
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
		borderRadius: radii.small,
		alignItems: "center",
		justifyContent: "center",
	},
	actionIconHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	actionIconSelected: chosenOutline,
	actionIconPressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	actionLabel: {
		...typography.caption,
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
		...typography.label,
		color: colors.textSecondary,
	},
});
