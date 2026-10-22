import { rect } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { EditorDocument } from "@/model/document";
import { documentFraming, type Framing, framingAnchor } from "@/model/framing";
import type { Size } from "@/model/geometry";
import { blendViewports, fitRectToView } from "../canvas/viewport";
import {
	boxWithRatio,
	type CropState,
	cropFraming,
	cropsEqual,
	cropViewBounds,
	flipCrop,
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
export const ASPECTS = [
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

/**
 * The crop tool's state and actions: the crop, shared with its gestures on
 * the UI thread and settled into React after each change, the aspect, fill,
 * and whether other layers turn too, and the view fitted around the photo
 * and box. Nothing reaches the document until `done`.
 */
export function useCropController(
	document: EditorDocument,
	onDone: (framing: Framing, turnLayers: boolean) => void,
) {
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

	const rotate = () => {
		update(rotateLeft(crop.value));
		const turned = TURNED[aspect];
		if (turned) setAspect(turned);
		if (ratio.value !== null) ratio.value = 1 / ratio.value;
	};

	const flip = () => update(flipCrop(crop.value));

	const reset = () => {
		update(resetCrop(photoSize));
		setAspect("free");
		ratio.value = null;
	};

	const done = () => {
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
	const straightenBegin = useCallback(() => {
		"worklet";
		straightenStart.value = crop.value;
		dragging.value = true;
	}, [crop, straightenStart, dragging]);
	const straightenChange = useCallback(
		(angle: number) => {
			"worklet";
			crop.value = straightenTo(straightenStart.value, angle, photoSize);
		},
		[crop, straightenStart, photoSize],
	);
	const straightenEnd = useCallback(() => {
		"worklet";
		dragging.value = false;
		scheduleOnRN(settle);
	}, [dragging, settle]);

	return {
		anchor,
		crop,
		ratio,
		dragging,
		viewport,
		visible,
		viewScale: fit.scale,
		setViewSize,
		settle,
		changed: !cropsEqual(settled, resetCrop(photoSize)),
		aspect,
		pickAspect,
		background,
		setBackground,
		turnLayers,
		toggleTurnLayers: () => setTurnLayers((turn) => !turn),
		rotate,
		flip,
		reset,
		done,
		straighten,
		straightenBegin,
		straightenChange,
		straightenEnd,
	};
}
