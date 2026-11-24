import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { type ComponentProps, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fadeTo } from "@/ui/gradient";
import { RingChoice } from "@/ui/RingChoice";
import { Segmented } from "@/ui/Segmented";
import { colors, space } from "@/ui/theme";
import type { PenEnds } from "../../layers/drawing/drawing";
import { ColorChip, ColorOptions } from "../../shell/ColorOptions";
import {
	BarChip,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SIZE_DOTS,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
	ToolSlider,
} from "../../shell/ToolOptions";
import { useColorTarget, useEditorContext } from "../editorContext";
import {
	clampOpacity,
	PEN_SIZES,
	type PenSettings,
	type PenTipChoice,
	penColor,
	penEndsOf,
	penOpacity,
	presetIndex,
	type Smoothing,
	sizeToSlider,
	sliderToSize,
	smoothings,
	stepPenSize,
	withPenColor,
	withPenEnds,
	withPenOpacity,
	withPenSize,
} from "./penSettings";
import type { PenController } from "./usePenTool";
export type PenTipMeta = {
	tip: PenTipChoice;
	title: string;
	icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

export const TIPS: readonly PenTipMeta[] = [
	{ tip: "pen", title: "Pen", icon: "draw-pen" },
	{ tip: "marker", title: "Highlighter", icon: "marker" },
	{ tip: "ink", title: "Marker", icon: "brush" },
	{ tip: "neon", title: "Neon", icon: "shimmer" },
] as const;

export const metaOf = (tip: PenTipChoice): PenTipMeta =>
	TIPS.find((item) => item.tip === tip) ?? TIPS[0];

const ENDS: readonly {
	ends: PenEnds;
	title: string;
	icon: PenTipMeta["icon"];
}[] = [
	{ ends: "square", title: "Square", icon: "square" },
	{ ends: "rounded", title: "Rounded", icon: "square-rounded" },
	{ ends: "round", title: "Round", icon: "circle" },
];

const SMOOTHING_TITLES: Record<Smoothing, string> = {
	off: "Off",
	light: "Light",
	strong: "Strong",
};

// The size dot's own size for a width: placed between the quick picks' dots
// as the width sits between theirs, on the slider's scale.
function dotSizeFor(tip: PenTipChoice, share: number): number {
	const along = sizeToSlider(tip, share);
	const first = sizeToSlider(tip, PEN_SIZES[tip][0]);
	const last = sizeToSlider(tip, PEN_SIZES[tip][PEN_SIZES[tip].length - 1]);
	const t = Math.min(1.15, Math.max(-0.2, (along - first) / (last - first)));
	const smallest = SIZE_DOTS[0];
	const largest = SIZE_DOTS[SIZE_DOTS.length - 1];
	return Math.max(3, Math.min(26, smallest + t * (largest - smallest)));
}

// What a dot previewing the current tip looks like besides its size.
function dotStyle(settings: PenSettings) {
	const { tip } = settings;
	return {
		color: penColor(settings),
		tip: tip === "pen" ? undefined : tip,
		ends: penEndsOf(settings) ?? undefined,
		opacity: penOpacity(settings) ?? undefined,
	};
}

/**
 * A value dragged along a slider, kept apart from the settings until the
 * finger lifts, so a drag is one change (one undo step on a mark).
 */
function useDraft(commit: (value: number) => void) {
	const [draft, setDraft] = useState<number | null>(null);
	// A tap begins and ends in one go, before the draft renders.
	const latest = useRef<number | null>(null);
	return {
		draft,
		move: (value: number) => {
			latest.current = value;
			setDraft(value);
		},
		end: () => {
			if (latest.current !== null) commit(latest.current);
			latest.current = null;
			setDraft(null);
		},
	};
}

/**
 * The current tip's size: its five quick picks, then a slider for any width
 * between and past them, written in the photo's pixels. A quick pick is
 * marked only while the width is one.
 */
function PenSizeOptions({
	controller: { settings, change, shortSide },
	nowrap = false,
}: {
	controller: PenController;
	nowrap?: boolean;
}) {
	const { tip } = settings;
	const { draft, move, end } = useDraft((share) =>
		change(withPenSize(settings, share)),
	);
	const share = draft ?? settings.sizes[tip];
	const chosen = presetIndex(tip, share);
	const style = dotStyle(settings);
	return (
		<View style={styles.sizeOptions}>
			<ToolChoices nowrap={nowrap}>
				{PEN_SIZES[tip].map((preset, index) => (
					<RingChoice
						key={preset}
						label={`Size ${index + 1} of ${PEN_SIZES[tip].length}`}
						selected={index === chosen}
						onPress={() => change(withPenSize(settings, preset))}
					>
						<SizeDot size={SIZE_DOTS[index]} {...style} />
					</RingChoice>
				))}
			</ToolChoices>
			<ToolSlider
				label="Size"
				value={sizeToSlider(tip, share)}
				valueText={`${Math.max(1, Math.round(share * shortSide))} px`}
				thumbColor={style.color}
				onMove={(along) => move(sliderToSize(tip, along))}
				onEnd={end}
				onStep={(step) => change(stepPenSize(settings, step))}
			/>
		</View>
	);
}

// The ink's opacity, over a track fading in the ink's color, named in a
// tray (`showLabel`). Not for the highlighter.
function PenOpacitySlider({
	controller: { settings, change },
	showLabel = false,
}: {
	controller: PenController;
	showLabel?: boolean;
}) {
	const { draft, move, end } = useDraft((opacity) =>
		change(withPenOpacity(settings, opacity)),
	);
	const saved = penOpacity(settings);
	if (saved === null) return null;
	const opacity = draft ?? saved;
	const color = penColor(settings);
	return (
		<ToolSlider
			label="Opacity"
			showLabel={showLabel}
			value={opacity}
			valueText={`${Math.round(opacity * 100)}%`}
			thumbColor={color}
			track={fadeTo("right", color)}
			onMove={(value) => move(clampOpacity(value))}
			onEnd={end}
			onStep={(step) => change(withPenOpacity(settings, saved + step * 0.05))}
		/>
	);
}

/**
 * Pen options in the wide editor's header bar:
 * - Tip, Color, and Size (quick picks and a slider; `[` and `]` step it).
 * - Opacity, for every tip but the highlighter.
 * - Ends, for the highlighter and the marker.
 * - Smoothing, how much a stroke evens out the hand's wobble.
 */
export function PenBar({ controller }: { controller: PenController }) {
	const { settings, change } = controller;
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withPenColor(settings, color)),
	);
	const tip = metaOf(settings.tip);
	const color = penColor(settings);
	const opacity = penOpacity(settings);
	const ends = penEndsOf(settings);
	const endsMeta = ENDS.find((each) => each.ends === ends);

	return (
		<BarSections>
			<BarGroup>
				<BarChip label={tip.title} icon={tip.icon} text={tip.title}>
					{(close) => (
						<OptionSegments
							label="Pen tip"
							options={TIPS.map(({ title, icon }) => ({ title, icon }))}
							selected={TIPS.findIndex((item) => item.tip === settings.tip)}
							onSelect={(index) => {
								const next = TIPS[index]?.tip;
								if (next && next !== settings.tip) {
									change({ ...settings, tip: next });
								}
								close();
							}}
						/>
					)}
				</BarChip>
				<ColorChip
					label="Color"
					value={color}
					customColor={customColor}
					onPick={(c) => c && change(withPenColor(settings, c))}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
				<BarChip
					label="Size"
					text="Size"
					shortcut="[ ]"
					glyph={
						<SizeDot
							size={dotSizeFor(settings.tip, settings.sizes[settings.tip])}
							color={colors.textPrimary}
						/>
					}
				>
					<PenSizeOptions controller={controller} nowrap />
				</BarChip>
			</BarGroup>
			<BarGroup>
				{opacity !== null && (
					<BarChip
						label="Opacity"
						icon="circle-opacity"
						text={`${Math.round(opacity * 100)}%`}
					>
						<PenOpacitySlider controller={controller} />
					</BarChip>
				)}
				{endsMeta && (
					<BarChip label="Ends" icon={endsMeta.icon} text={endsMeta.title}>
						{(close) => (
							<OptionSegments
								label="Ends"
								options={ENDS.map(({ title, icon }) => ({ title, icon }))}
								selected={ENDS.indexOf(endsMeta)}
								onSelect={(index) => {
									const next = ENDS[index]?.ends;
									if (next) change(withPenEnds(settings, next));
									close();
								}}
							/>
						)}
					</BarChip>
				)}
				<BarChip
					label="Smoothing"
					icon="vector-curve"
					text={SMOOTHING_TITLES[settings.smoothing]}
				>
					{(close) => (
						<OptionSegments
							label="Smoothing"
							options={smoothings.map((each) => ({
								title: SMOOTHING_TITLES[each],
							}))}
							selected={smoothings.indexOf(settings.smoothing)}
							onSelect={(index) => {
								const next = smoothings[index];
								if (next) change({ ...settings, smoothing: next });
								close();
							}}
						/>
					)}
				</BarChip>
			</BarGroup>
		</BarSections>
	);
}

/**
 * Dock buttons on phone:
 * - 4 tips: 1-tap toggling between Pen, Highlighter, Marker, Neon.
 * - Style button showing current swatch, opening shared tray.
 */
export function PenPanel({
	controller: { settings, change },
}: {
	controller: PenController;
}) {
	const { trayOpen, toggleTray } = useEditorContext();

	const selectTip = (tip: PenTipChoice) => {
		if (settings.tip === tip) {
			toggleTray();
		} else {
			change({ ...settings, tip });
		}
	};

	return (
		<ToolRow>
			{TIPS.map(({ tip, title, icon }) => (
				<ToolButton
					key={tip}
					label={title}
					icon={icon}
					selected={settings.tip === tip}
					onPress={() => selectTip(tip)}
				/>
			))}
			<ToolButton
				label="Style"
				icon="palette-outline"
				glyph={<ColorGlyph color={penColor(settings)} />}
				open={trayOpen}
				onPress={toggleTray}
			/>
		</ToolRow>
	);
}

/**
 * Tray rising above the phone dock with the current tip's options: color,
 * size, opacity, ends, and smoothing. The tips themselves are the dock's,
 * just under it.
 */
export function PenTray({ controller }: { controller: PenController }) {
	const { settings, change } = controller;
	const { bottomInset, rightInset, closeTray } = useEditorContext();
	const { customColor, onPickCustom, onEyedropper } = useColorTarget((color) =>
		change(withPenColor(settings, color)),
	);
	const color = penColor(settings);
	const ends = penEndsOf(settings);

	return (
		<ToolOptions
			closeLabel="Close pen options"
			bottomInset={bottomInset}
			rightInset={rightInset}
			onClose={closeTray}
			dismissOnOutsidePress={false}
		>
			<ToolOption label="Color">
				<ColorOptions
					value={color}
					customColor={customColor}
					onPick={(c) => c && change(withPenColor(settings, c))}
					onPickCustom={onPickCustom}
					onEyedropper={onEyedropper}
				/>
			</ToolOption>
			<ToolOption label="Size">
				<PenSizeOptions controller={controller} />
			</ToolOption>
			<PenOpacitySlider controller={controller} showLabel />
			<View style={styles.pair}>
				{ends !== null && (
					<ToolOption label="Ends">
						<ToolChoices nowrap>
							{ENDS.map((each) => (
								<RingChoice
									key={each.ends}
									variant="highlight"
									label={`${each.title} ends`}
									selected={ends === each.ends}
									onPress={() => change(withPenEnds(settings, each.ends))}
								>
									{(ink) => (
										<MaterialCommunityIcons
											name={each.icon}
											size={20}
											color={ink}
										/>
									)}
								</RingChoice>
							))}
						</ToolChoices>
					</ToolOption>
				)}
				<View style={styles.smoothing}>
					<ToolOption label="Smoothing">
						<Segmented
							accessibilityLabel="Smoothing"
							options={smoothings.map((each) => ({
								title: SMOOTHING_TITLES[each],
							}))}
							selected={smoothings.indexOf(settings.smoothing)}
							onSelect={(index) => {
								const next = smoothings[index];
								if (next) change({ ...settings, smoothing: next });
							}}
						/>
					</ToolOption>
				</View>
			</View>
		</ToolOptions>
	);
}

function ColorGlyph({ color }: { color: string }) {
	return <View style={[styles.colorTile, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
	sizeOptions: {
		gap: space.xxs,
	},
	pair: {
		flexDirection: "row",
		gap: space.lg,
	},
	smoothing: {
		flexGrow: 1,
		flexShrink: 1,
	},
	colorTile: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: colors.swatchRing,
	},
});
