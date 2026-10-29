import {
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { rect } from "react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import { blendViewports, fitRectToView } from "../../canvas/viewport";
import type { ToolEnv } from "../../defineTool";
import type { EditorDocument } from "../../document/document";
import { documentFraming, framingAnchor } from "../../document/framing";
import type { Size } from "../../document/geometry";
import { useStore } from "../../store";
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
import {
	type AspectId,
	aspectRatio,
	turnedAspect,
	turnLayersLabel,
} from "./cropOptions";

const REFIT = { duration: 220 };
// Room around the photo and box when fitting them to the view, in screen
// pixels. The crop gesture lets the box be dragged out into it.
const CROP_INSET_PX = 20;

/** Crop's modes, each with its own controls. */
export type CropTab = "crop" | "rotate" | "canvas";

export type CropController = ReturnType<typeof useCropTool>;

/**
 * Crop's state and actions: the crop, shared with its gestures on the UI
 * thread and settled into React after each change, the aspect, fill, and
 * whether other layers turn too, the chosen tab, and the view fitted around
 * the photo and box.
 * - The draft starts from the document each time the tool opens, and again
 *   if the document changes while it's open (Done, then opened again at
 *   once from the rail).
 * - Nothing reaches the document until `done`, which reframes it once
 *   inside the tool's session, so the crop is one undo step and Cancel
 *   leaves none.
 */
export function useCropTool({ document, open }: ToolEnv) {
	const { reframe } = useStore((state) => state.actions);
	const anchor = useMemo(() => framingAnchor(document), [document]);
	const photoSize = useMemo(
		() => ({ width: anchor.width, height: anchor.height }),
		[anchor.width, anchor.height],
	);
	const [initial, setInitial] = useState(() => startCrop(document));
	const crop = useSharedValue<CropState>(initial);
	// The crop as React last saw it: at the end of each drag, and each button.
	const [settled, setSettled] = useState(initial);
	const [aspect, setAspect] = useState<AspectId>("free");
	const ratio = useSharedValue<number | null>(null);
	const [background, setBackground] = useState(document.background);
	const [turnLayers, setTurnLayers] = useState(false);
	const [tab, setTab] = useState<CropTab>("crop");
	const dragging = useSharedValue(false);
	const straightenStart = useSharedValue<CropState>(initial);
	const [viewSize, setViewSize] = useState<Size>({ width: 0, height: 0 });

	// The document the draft started from, while it's open.
	const [seeded, setSeeded] = useState<EditorDocument | null>(null);
	const seedFrom = open ? document : null;
	if (seeded !== seedFrom) {
		setSeeded(seedFrom);
		if (seedFrom) {
			const start = startCrop(seedFrom);
			setInitial(start);
			setSettled(start);
			setAspect("free");
			setBackground(seedFrom.background);
			setTurnLayers(false);
			setTab("crop");
		}
	}

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
	// The fit last eased to or jumped to.
	const shownFit = useRef(fit);
	useEffect(() => {
		if (fit === shownFit.current) return;
		shownFit.current = fit;
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

	// A new draft's view starts fitted to it, rather than easing from the
	// last crop's.
	const jumpToFit = useEffectEvent(() => {
		shownFit.current = fit;
		fitFrom.value = fit;
		fitTo.value = fit;
		fitProgress.value = 1;
	});
	useLayoutEffect(() => {
		crop.value = initial;
		straightenStart.value = initial;
		ratio.value = null;
		jumpToFit();
	}, [initial, crop, straightenStart, ratio]);

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
		const value = aspectRatio(
			id,
			turnedSize(photoSize, crop.value.quarterTurns),
		);
		setAspect(id);
		ratio.value = value;
		if (value !== null) {
			update({ ...crop.value, box: boxWithRatio(crop.value.box, value) });
		}
	};

	const rotate = () => {
		update(rotateLeft(crop.value));
		const turned = turnedAspect(aspect);
		if (turned) setAspect(turned);
		if (ratio.value !== null) ratio.value = 1 / ratio.value;
	};

	const flip = () => update(flipCrop(crop.value));

	const reset = () => {
		update(resetCrop(photoSize));
		setAspect("free");
		ratio.value = null;
	};

	// An untouched crop keeps the framing, with the fill that was picked.
	const done = () => {
		const final = crop.value;
		reframe(
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
		document,
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
		// What the switch to turn other layers is called; null hides it.
		turnLabel: turnLayersLabel(document.layers, anchor.layer),
		tab,
		setTab,
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
