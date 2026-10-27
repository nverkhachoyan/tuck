import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BackgroundPicker } from "@/ui/BackgroundPicker";
import { CheckerFill } from "@/ui/CheckerFill";
import { Chip } from "@/ui/Chip";
import { compactControls } from "@/ui/density";
import { Highlight } from "@/ui/Highlight";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { colors, radii, typography, webTransition } from "@/ui/theme";
import {
	BarButton,
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { Dial } from "../../shell/Dial";
import type { DialScale } from "../../shell/dialDrag";
import { MAX_STRAIGHTEN } from "./cropGeometry";
import { ASPECT_ROWS, ASPECTS, type AspectId } from "./cropOptions";
import type { useCropController } from "./useCropController";

export type CropTab = "crop" | "rotate" | "canvas";
type CropController = ReturnType<typeof useCropController>;

// A degree a step, a long tick every 15, settling level from a degree away.
export const DEGREES: DialScale = {
	step: Math.PI / 180,
	pxPerStep: 8,
	tickEvery: 1,
	majorEvery: 15,
	snap: 1,
};

export const CROP_TABS: { tab: CropTab; label: string; icon: IconName }[] = [
	{ tab: "crop", label: "Crop", icon: "crop" },
	{ tab: "rotate", label: "Rotate", icon: "format-rotate-90" },
	{ tab: "canvas", label: "Fill", icon: "checkerboard" },
];

const TAB_IN = FadeIn.duration(160);

/**
 * The phone's controls for the chosen tab, fading in as it changes: the
 * ratios in a row, Rotate's dial over its actions, or the backgrounds.
 */
export function CropControls({
	tab,
	controller,
	turnLabel,
}: {
	tab: CropTab;
	controller: CropController;
	// What the switch to turn other layers is called; null hides it.
	turnLabel: string | null;
}) {
	const { anchor, aspect, background, turnLayers } = controller;
	return (
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
						{turnLabel && (
							<ActionButton
								icon="format-text-rotation-angle-up"
								label={turnLabel}
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
	);
}

/** The wide header's modes, then the options for the one that's chosen. */
export function CropBar({
	tab,
	aspect,
	background,
	turnLayers,
	turnLabel,
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
	// What the switch to turn other layers is called; null hides it.
	turnLabel: string | null;
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
					options={CROP_TABS.map(({ label, icon }) => ({ title: label, icon }))}
					selected={CROP_TABS.findIndex((item) => item.tab === tab)}
					onSelect={(index) => {
						const next = CROP_TABS[index];
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
				{tab === "rotate" && turnLabel && (
					<BarButton
						icon={turnLayers ? "checkbox-marked" : "checkbox-blank-outline"}
						label={turnLabel}
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
					{ASPECT_ROWS.map((group) => (
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
				<BackgroundPicker
					value={value}
					onPick={(background) => {
						onPick(background);
						setOpen(false);
					}}
				/>
			</Popover>
		</>
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
			aria-checked={selected}
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
});
