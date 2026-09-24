import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { rect } from "@shopify/react-native-skia";
import {
	type ComponentProps,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	BackHandler,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import {
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { EditorDocument } from "@/model/document";
import { documentFraming, type Framing, framingAnchor } from "@/model/framing";
import type { Size } from "@/model/geometry";
import { colors } from "@/theme";
import { AngleDial } from "@/ui/AngleDial";
import { TextButton } from "@/ui/TextButton";
import { BackgroundPicker } from "../BackgroundPicker";
import { blendViewports, fitRectToView } from "../viewport";
import { CropCanvas } from "./CropCanvas";
import {
	boxWithRatio,
	type CropState,
	cropFraming,
	cropsEqual,
	cropViewBounds,
	flipCrop,
	MAX_STRAIGHTEN,
	resetCrop,
	rotateLeft,
	startCrop,
	straightenTo,
	turnedSize,
} from "./cropGeometry";

const REFIT = { duration: 220 };
// Room around the photo and box when fitting them to the view, in screen
// pixels. The crop gesture lets the box be dragged out into it.
const CROP_INSET_PX = 20;

// Width / height, or "original" for the photo's own. Each fixed ratio's
// turned counterpart is listed too, so turning the photo keeps one selected.
const ASPECTS = [
	{ id: "free", label: "Free", ratio: null },
	{ id: "original", label: "Original", ratio: "original" },
	{ id: "1:1", label: "Square", ratio: 1 },
	{ id: "4:5", label: "4:5", ratio: 4 / 5 },
	{ id: "5:4", label: "5:4", ratio: 5 / 4 },
	{ id: "3:4", label: "3:4", ratio: 3 / 4 },
	{ id: "4:3", label: "4:3", ratio: 4 / 3 },
	{ id: "9:16", label: "9:16", ratio: 9 / 16 },
	{ id: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
type AspectId = (typeof ASPECTS)[number]["id"];

const TURNED: Partial<Record<AspectId, AspectId>> = {
	"4:5": "5:4",
	"5:4": "4:5",
	"3:4": "4:3",
	"4:3": "3:4",
	"9:16": "16:9",
	"16:9": "9:16",
};

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
	const anchor = useMemo(() => framingAnchor(document), [document]);
	const photoSize = useMemo(
		() => ({ width: anchor.width, height: anchor.height }),
		[anchor.width, anchor.height],
	);
	const [initial] = useState(() => startCrop(document));
	const crop = useSharedValue<CropState>(initial);
	// The crop as React last saw it: at the end of each drag, and each button.
	const [settled, setSettled] = useState(initial);
	const [aspect, setAspect] = useState<AspectId>("free");
	const ratio = useSharedValue<number | null>(null);
	const [background, setBackground] = useState(document.background);
	const [turnLayers, setTurnLayers] = useState(false);
	const dragging = useSharedValue(false);
	const straightenStart = useSharedValue<CropState>(initial);
	const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });
	const hasOtherLayers = document.layers.some(
		(layer) => layer !== anchor.layer && !layer.hidden,
	);
	const onlyText = document.layers.every(
		(layer) => layer === anchor.layer || layer.type === "text",
	);

	// Fits the photo and the box, easing there when the box grows past it.
	const fit = useMemo(
		() =>
			fitRectToView(
				cropViewBounds(settled, photoSize),
				viewSize,
				CROP_INSET_PX,
			),
		[settled, photoSize, viewSize],
	);
	const fitFrom = useSharedValue(fit);
	const fitTo = useSharedValue(fit);
	const fitProgress = useSharedValue(1);
	const viewport = useDerivedValue(() =>
		blendViewports(fitFrom.value, fitTo.value, fitProgress.value),
	);
	useEffect(() => {
		fitTo.value = fit;
		// The first fit, once the view has a size, is where it starts.
		if (viewport.value.scale === 0) {
			fitFrom.value = fit;
			fitProgress.value = 1;
			return;
		}
		fitFrom.value = viewport.value;
		fitProgress.value = 0;
		fitProgress.value = withTiming(1, REFIT);
	}, [fit, viewport, fitFrom, fitTo, fitProgress]);
	const visible = useMemo(
		() =>
			fit.scale === 0
				? rect(0, 0, 0, 0)
				: rect(
						-fit.offsetX / fit.scale,
						-fit.offsetY / fit.scale,
						viewSize.width / fit.scale,
						viewSize.height / fit.scale,
					),
		[fit, viewSize],
	);

	const settle = useCallback(() => setSettled(crop.value), [crop]);
	const update = (next: CropState) => {
		crop.value = next;
		setSettled(next);
	};

	const pickAspect = (id: AspectId) => {
		const choice = ASPECTS.find((option) => option.id === id);
		if (!choice) return;
		const turned = turnedSize(photoSize, crop.value.quarterTurns);
		const value =
			choice.ratio === "original" ? turned.width / turned.height : choice.ratio;
		setAspect(id);
		ratio.value = value;
		if (value !== null) {
			update({ ...crop.value, box: boxWithRatio(crop.value.box, value) });
		}
	};

	const handleRotate = () => {
		update(rotateLeft(crop.value));
		const turned = TURNED[aspect];
		if (turned) setAspect(turned);
		if (ratio.value !== null) ratio.value = 1 / ratio.value;
	};

	const handleReset = () => {
		update(resetCrop(photoSize));
		setAspect("free");
		ratio.value = null;
	};

	const handleDone = () => {
		const final = crop.value;
		onDone(
			cropsEqual(initial, final)
				? { ...documentFraming(document), background }
				: cropFraming(final, photoSize, anchor.transform.scaleX, background),
			turnLayers,
		);
	};

	// Straightening starts from the crop as the dial was grabbed, so turning
	// back restores it exactly.
	const straighten = useDerivedValue(() => crop.value.straighten);
	const handleStraightenBegin = useCallback(() => {
		"worklet";
		straightenStart.value = crop.value;
		dragging.value = true;
	}, [crop, straightenStart, dragging]);
	const handleStraighten = useCallback(
		(angle: number) => {
			"worklet";
			crop.value = straightenTo(straightenStart.value, angle, photoSize);
		},
		[crop, straightenStart, photoSize],
	);
	const handleStraightenEnd = useCallback(() => {
		"worklet";
		dragging.value = false;
		scheduleOnRN(settle);
	}, [dragging, settle]);

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
				handleDone();
			} else if (event.key === "Escape") onCancel();
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});

	const changed = !cropsEqual(settled, resetCrop(photoSize));

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TextButton label="Cancel" onPress={onCancel} />
				{changed && <TextButton label="Reset" onPress={handleReset} />}
				<TextButton label="Done" tone="accent" onPress={handleDone} />
			</View>

			<CropCanvas
				document={document}
				anchor={anchor}
				crop={crop}
				viewport={viewport}
				ratio={ratio}
				dragging={dragging}
				visible={visible}
				viewScale={fit.scale}
				background={background}
				turnLayers={turnLayers}
				onLayout={setViewSize}
				onDragEnd={settle}
			/>

			<View style={styles.panel}>
				{/* Levels a tilted photo; a canvas alone has nothing to level. */}
				{anchor.layer && (
					<AngleDial
						value={straighten}
						max={MAX_STRAIGHTEN}
						label="Straighten"
						onBegin={handleStraightenBegin}
						onChange={handleStraighten}
						onEnd={handleStraightenEnd}
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
								onPress={() => pickAspect(id)}
								accessibilityRole="button"
								accessibilityLabel={`Aspect ratio ${label}`}
								accessibilityState={{ selected }}
								style={styles.target}
							>
								<View style={[styles.chip, selected && styles.chipSelected]}>
									<Text style={styles.chipLabel}>{label}</Text>
								</View>
							</Pressable>
						);
					})}
				</ScrollView>
				<View style={styles.actions}>
					<ActionButton
						icon="rotate-left"
						label="Rotate"
						onPress={handleRotate}
					/>
					<ActionButton
						icon="flip-horizontal"
						label="Flip"
						onPress={() => update(flipCrop(crop.value))}
					/>
					{hasOtherLayers && (
						<ActionButton
							icon="format-text-rotation-angle-up"
							label={onlyText ? "Turn text" : "Turn layers"}
							selected={turnLayers}
							onPress={() => setTurnLayers((turn) => !turn)}
						/>
					)}
				</View>
				<View style={styles.fill}>
					<Text style={styles.fillLabel}>Fill</Text>
					<BackgroundPicker value={background} onPick={setBackground} />
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
	const color = selected ? colors.accent : colors.textPrimary;
	return (
		<Pressable
			hitSlop={6}
			onPress={onPress}
			accessibilityRole={selected === undefined ? "button" : "switch"}
			accessibilityLabel={label}
			accessibilityState={
				selected === undefined ? undefined : { checked: selected }
			}
			style={({ pressed }) => [styles.action, pressed && styles.pressed]}
		>
			<MaterialCommunityIcons name={icon} size={24} color={color} />
			<Text style={[styles.actionLabel, { color }]}>{label}</Text>
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
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	panel: {
		gap: 4,
		paddingTop: 8,
		paddingBottom: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
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
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		justifyContent: "center",
	},
	chipSelected: {
		borderWidth: 2,
		borderColor: colors.accent,
	},
	chipLabel: {
		fontSize: 14,
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
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
	},
	pressed: {
		opacity: 0.5,
	},
	actionLabel: {
		fontSize: 11,
		fontWeight: "500",
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
