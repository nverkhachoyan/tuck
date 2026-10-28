import { type ComponentProps, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EditorDocument } from "@/model/document";
import type { Framing } from "@/model/framing";
import { CanvasStage } from "@/ui/CanvasStage";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextButton } from "@/ui/TextButton";
import { colors } from "@/ui/theme";
import { ContextBar } from "../shell/ContextBar";
import { Dock, DockFooter, useDockInset } from "../shell/Dock";
import { ToolButton, ToolRow } from "../shell/ToolButton";
import { CropCanvas } from "./CropCanvas";
import {
	CROP_TABS,
	CropBar,
	CropControls,
	type CropTab,
	StraightenDial,
} from "./CropPanel";
import { turnLayersLabel } from "./cropOptions";
import { useCropController } from "./useCropController";

// Room for the tallest tab's controls, so the canvas holds still as tabs
// change: Rotate's dial over its actions, or the actions alone when there's
// no photo to level.
const CONTROLS_WITH_DIAL = 120;
const CONTROLS_WITHOUT_DIAL = 64;
// The wide layout keeps this strip under the photo in every mode, so the
// photo holds still when Rotate is chosen. The dial sits in it, centered.
const DIAL_STRIP = 100;
const DIAL_WIDTH = 360;

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
	const { anchor, background, turnLayers } = controller;
	const dockInset = useDockInset();
	const [tab, setTab] = useState<CropTab>("crop");
	const turnLabel = turnLayersLabel(document.layers, anchor.layer);

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

	useCropKeys(controller.done);

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
								controller={controller}
								turnLabel={turnLabel}
								onTab={setTab}
							/>
						</ContextBar>
					}
					action={reset}
				/>
				{stage}
				<DialStrip
					show={tab === "rotate" && anchor.layer !== null}
					dial={{
						value: controller.straighten,
						onBegin: controller.straightenBegin,
						onChange: controller.straightenChange,
						onEnd: controller.straightenEnd,
					}}
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
				<CropControls tab={tab} controller={controller} turnLabel={turnLabel} />
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
					{CROP_TABS.map(({ tab: value, label, icon }) => (
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

/**
 * Room for the straighten dial under the photo, whether or not it's showing,
 * so choosing Rotate doesn't move the crop.
 */
function DialStrip({
	show,
	dial,
}: {
	show: boolean;
	dial: ComponentProps<typeof StraightenDial>;
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
					<StraightenDial {...dial} />
				</View>
			)}
		</View>
	);
}

/**
 * Crop's keys on web: Escape applies from anywhere in the tool, as it's Done
 * in the other tools, and Enter applies from the canvas, while controls keep
 * their own. The crop is one undo step.
 */
function useCropKeys(done: () => void) {
	const latest = useRef(done);
	latest.current = done;
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
				latest.current();
			} else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
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
	dialStrip: {
		alignItems: "center",
		justifyContent: "center",
	},
	dial: {
		width: DIAL_WIDTH,
	},
});
