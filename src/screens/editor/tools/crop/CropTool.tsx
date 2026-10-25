import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EditorDocument } from "@/model/document";
import type { Framing } from "@/model/framing";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { CanvasStage } from "@/ui/CanvasStage";
import { CheckerFill } from "@/ui/CheckerFill";
import { Chip } from "@/ui/Chip";
import { compactControls } from "@/ui/density";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { colors, radii, typography, webTransition } from "@/ui/theme";
import {
	BarButton,
	BarChip,
	BarGroup,
	BarSections,
	ContextBar,
	OptionSegments,
} from "../../shell/ContextBar";
import { Dial } from "../../shell/Dial";
import { Dock, DockFooter, useDockInset } from "../../shell/Dock";
import type { DialScale } from "../../shell/dialDrag";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
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
	{ tab: "canvas", label: "Fill", icon: "checkerboard" },
];

// Room for the tallest tab's controls, so the canvas holds still as tabs
// change: Rotate's dial over its actions, or the actions alone when there's
// no photo to level.
const CONTROLS_WITH_DIAL = 120;
const CONTROLS_WITHOUT_DIAL = 64;
// The wide layout keeps this strip under the photo in every mode, so the
// photo holds still when Rotate is chosen. The dial sits in it, centered.
const DIAL_STRIP = 100;
const DIAL_WIDTH = 360;
const TAB_IN = FadeIn.duration(160);
// The ratio chip's rows: free shapes, then portrait, then landscape.
type AspectId = (typeof ASPECTS)[number]["id"];
const ASPECT_GROUPS: readonly AspectId[][] = [
	["free", "original", "1:1"],
	["4:5", "3:4", "9:16"],
	["5:4", "4:3", "16:9"],
];

type CropToolProps = {
	document: EditorDocument;
	// A wide window puts the options in the header. A phone keeps the dock.
	wide?: boolean;
	onCancel: () => void;
	// Gets the document's new framing, and whether other layers turn with
	// the photo; an untouched crop gives back the current one.
	onDone: (framing: Framing, turnLayers: boolean) => void;
};

/**
 * Crops, turns, flips, and straightens the photo (the lowest locked one, see
 * `framingAnchor`), and sizes and fills the canvas around it, over the editor
 * until Done or Cancel.
 * - The box is the canvas-to-be: dragging it past the photo's edges expands
 *   the canvas. With no locked photo, the canvas itself is cropped and turned.
 * - Nothing reaches the document until Done, which is one undo step.
 * - A wide window keeps the modes in the header and a strip under the photo
 *   for the straighten dial. A phone keeps the dock, with each tab's controls
 *   just above it. Its header covers the editor's.
 */
export function CropTool({
	document,
	wide = false,
	onCancel,
	onDone,
}: CropToolProps) {
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

	// Android's back button applies the crop, as Done does.
	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				controller.done();
				return true;
			},
		);
		return () => subscription.remove();
	}, [controller.done]);

	// Return applies from the canvas, while controls keep their normal keyboard
	// behavior. Escape applies from anywhere in the tool, as it's Done in the
	// other tools; the crop is one undo step.
	useEffect(() => {
		if (Platform.OS !== "web") return;
		const handleKeyDown = (event: KeyboardEvent) => {
			// A popover takes Escape first, in the capture phase, and marks it
			// handled. Applying here too would finish the crop as the menu closed.
			if (event.defaultPrevented) return;
			if (
				event.key === "Escape" ||
				(event.key === "Enter" && !isInteractiveElement(event.target))
			) {
				controller.done();
			} else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});

	const reset = controller.changed && (
		<TextButton label="Reset" onPress={controller.reset} />
	);
	const stage = (
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
	);

	if (wide) {
		return (
			<View style={styles.container}>
				<ScreenHeader
					bar={
						<ContextBar
							title="Crop"
							onCancel={onCancel}
							onDone={controller.done}
							doneShortcut="Enter"
						>
							<CropBar
								tab={tab}
								aspect={aspect}
								background={background}
								turnLayers={turnLayers}
								hasOtherLayers={hasOtherLayers}
								onlyText={onlyText}
								onTab={setTab}
								onAspect={controller.pickAspect}
								onRotate={controller.rotate}
								onFlip={controller.flip}
								onTurnLayers={controller.toggleTurnLayers}
								onBackground={controller.setBackground}
							/>
						</ContextBar>
					}
					action={reset}
				/>
				{stage}
				<DialStrip
					show={tab === "rotate" && anchor.layer !== null}
					straighten={controller.straighten}
					onBegin={controller.straightenBegin}
					onChange={controller.straightenChange}
					onEnd={controller.straightenEnd}
				/>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{/* As tall as the editor's header, so the canvas keeps its place. */}
			<ScreenHeader action={reset} />
			{stage}
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
								<AspectChoice
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
							<Text style={styles.fillLabel}>Background</Text>
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

/** The wide header's modes, then the options for the one that's chosen. */
function CropBar({
	tab,
	aspect,
	background,
	turnLayers,
	hasOtherLayers,
	onlyText,
	onTab,
	onAspect,
	onRotate,
	onFlip,
	onTurnLayers,
	onBackground,
}: {
	tab: CropTab;
	aspect: AspectId;
	background: string | null;
	turnLayers: boolean;
	hasOtherLayers: boolean;
	onlyText: boolean;
	onTab: (tab: CropTab) => void;
	onAspect: (id: AspectId) => void;
	onRotate: () => void;
	onFlip: () => void;
	onTurnLayers: () => void;
	onBackground: (background: string | null) => void;
}) {
	const current = ASPECTS.find((option) => option.id === aspect);
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Crop"
					options={TABS.map(({ label, icon }) => ({ title: label, icon }))}
					selected={TABS.findIndex((item) => item.tab === tab)}
					onSelect={(index) => {
						const next = TABS[index];
						if (next) onTab(next.tab);
					}}
				/>
			</BarGroup>
			{/* Each option is its own child. A fragment would be one slot, and
			    the buttons would stack in it. */}
			<BarGroup>
				{tab === "crop" && (
					<AspectMenu
						label={current?.label ?? "Free"}
						selected={aspect}
						onPick={onAspect}
					/>
				)}
				{tab === "rotate" && (
					<BarButton icon="rotate-left" label="Rotate 90°" onPress={onRotate} />
				)}
				{tab === "rotate" && (
					<BarButton icon="flip-horizontal" label="Flip" onPress={onFlip} />
				)}
				{tab === "rotate" && hasOtherLayers && (
					<BarButton
						icon={turnLayers ? "checkbox-marked" : "checkbox-blank-outline"}
						label={onlyText ? "Turn text" : "Turn layers"}
						checked={turnLayers}
						onPress={onTurnLayers}
					/>
				)}
				{tab === "canvas" && (
					<BackgroundChip value={background} onPick={onBackground} />
				)}
			</BarGroup>
		</BarSections>
	);
}

/** The current ratio, opening the three rows of choices. */
function AspectMenu({
	label,
	selected,
	onPick,
}: {
	label: string;
	selected: AspectId;
	onPick: (id: AspectId) => void;
}) {
	return (
		<BarChip label={`Aspect ratio ${label}`} icon="aspect-ratio" text={label}>
			{(close) => (
				<View style={styles.aspectMenu}>
					{ASPECT_GROUPS.map((group) => (
						<View key={group.join()} style={styles.aspectRow}>
							{group.map((id) => {
								const choice = ASPECTS.find((option) => option.id === id);
								if (!choice) return null;
								return (
									<AspectChoice
										key={id}
										label={choice.label}
										selected={id === selected}
										onPress={() => {
											onPick(id);
											close();
										}}
									/>
								);
							})}
						</View>
					))}
				</View>
			)}
		</BarChip>
	);
}

/** One ratio, highlighted while it's the crop's. */
function AspectChoice({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	return (
		<Chip
			selected={selected}
			onPress={onPress}
			accessibilityLabel={`Aspect ratio ${label}`}
			hitSlop={4}
			style={styles.target}
			frameStyle={styles.chip}
		>
			<Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
				{label}
			</Text>
		</Chip>
	);
}

/** The canvas fill, as a swatch that opens the three backgrounds. */
function BackgroundChip({
	value,
	onPick,
}: {
	value: string | null;
	onPick: (background: string | null) => void;
}) {
	const anchor = useRef<View>(null);
	const [open, setOpen] = useState(false);
	const label =
		value === "#FFFFFF"
			? "White background"
			: value === "#000000"
				? "Black background"
				: "Transparent background";
	return (
		<>
			<Pressable
				ref={anchor}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ expanded: open }}
				aria-expanded={open}
				onPress={() => setOpen((shown) => !shown)}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.backgroundChip,
						webTransition,
						hovered && styles.backgroundChipHovered,
						pressed && styles.backgroundChipPressed,
					];
				}}
			>
				<Text style={styles.backgroundLabel}>Background</Text>
				<View
					style={[
						styles.backgroundSwatch,
						value !== null && { backgroundColor: value },
					]}
				>
					{value === null && <CheckerFill width={20} height={20} cell={10} />}
				</View>
			</Pressable>
			<Popover
				anchor={anchor}
				open={open}
				onClose={() => setOpen(false)}
				label={label}
			>
				<BackgroundPicker value={value} onPick={onPick} />
			</Popover>
		</>
	);
}

/**
 * Room for the straighten dial under the photo, whether or not it's showing,
 * so choosing Rotate doesn't move the crop.
 */
function DialStrip({
	show,
	straighten,
	onBegin,
	onChange,
	onEnd,
}: {
	show: boolean;
	straighten: ComponentProps<typeof Dial>["value"];
	onBegin: ComponentProps<typeof Dial>["onBegin"];
	onChange: ComponentProps<typeof Dial>["onChange"];
	onEnd: ComponentProps<typeof Dial>["onEnd"];
}) {
	const { bottom } = useSafeAreaInsets();
	return (
		<View
			style={[
				styles.dialStrip,
				{ height: DIAL_STRIP + bottom, paddingBottom: bottom },
			]}
		>
			{show && (
				<View style={styles.dial}>
					<Dial
						value={straighten}
						max={MAX_STRAIGHTEN}
						scale={DEGREES}
						label="Straighten"
						increaseLabel="Increase angle"
						decreaseLabel="Decrease angle"
						readout={(degrees) => `${degrees}°`}
						valueText={(degrees) => `${degrees} degrees`}
						onBegin={onBegin}
						onChange={onChange}
						onEnd={onEnd}
					/>
				</View>
			)}
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

/** An icon over a small label; `selected` highlights a toggle that's on. */
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
								pressed && styles.actionIconPressed,
							]}
						>
							{selected && <Highlight />}
							<MaterialCommunityIcons
								name={icon}
								size={22}
								color={selected ? colors.onHighlight : colors.textPrimary}
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
	},
	chipLabel: {
		...typography.label,
		fontVariant: ["tabular-nums"],
		color: colors.textPrimary,
	},
	chipLabelSelected: {
		color: colors.onHighlight,
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
	aspectMenu: {
		gap: 4,
	},
	aspectRow: {
		flexDirection: "row",
		gap: 8,
	},
	backgroundChip: {
		height: compactControls ? 36 : 44,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		borderRadius: radii.small,
	},
	backgroundChipHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	backgroundChipPressed: {
		backgroundColor: colors.pressedOverlay,
		transform: [{ scale: 0.92 }],
	},
	backgroundLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	backgroundSwatch: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.swatchRing,
		overflow: "hidden",
	},
	dialStrip: {
		alignItems: "center",
		justifyContent: "center",
	},
	dial: {
		width: DIAL_WIDTH,
	},
});
