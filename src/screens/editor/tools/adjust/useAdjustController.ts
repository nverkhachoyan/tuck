import { useCallback, useLayoutEffect, useState } from "react";
import { Platform } from "react-native";
import {
	type DerivedValue,
	type SharedValue,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import {
	type AdjustmentKey,
	type Adjustments,
	adjustmentMatrix,
	type ColorMatrix,
	neutralAdjustments,
} from "@/model/adjustments";
import type { ImageLayer } from "@/model/document";
import type { DialScale } from "../../controls/Dial";

// The dial counts in percent: -100 to 100 for -1 to 1.
export const ADJUST_DIAL_MAX = 100;

// A percent a step, with a tick every 5 and a long one every 25, settling on
// 0 from 2 away. A drag over the photo moves it at the same rate.
export const ADJUST_DIAL_SCALE: DialScale = {
	step: 1,
	pxPerStep: 3,
	tickEvery: 5,
	majorEvery: 25,
	snap: 2,
	wholeSteps: true,
};

export type AdjustController = {
	matrix: DerivedValue<ColorMatrix>;
	chosen: AdjustmentKey;
	choose: (key: AdjustmentKey) => void;
	// The chosen adjustment, in the dial's percent.
	dialValue: DerivedValue<number>;
	// Worklets bracketing a change to the chosen adjustment, which `changing`
	// is true between.
	begin: () => void;
	change: (percent: number) => void;
	end: () => void;
	changing: SharedValue<boolean>;
};

function syncAdjustments(
	values: SharedValue<Adjustments>,
	held: SharedValue<boolean>,
	next: Adjustments,
) {
	"worklet";
	if (!held.value) values.value = next;
}

/**
 * Live adjustments for `layer`, which a dial changes on the UI thread and
 * `matrix` follows, with no React render along the way. A change reaches
 * the document once it ends, as one undo step. Otherwise they follow the
 * document, through undo and redo.
 */
export function useAdjustController(
	layer: ImageLayer | undefined,
	setAdjustments: (id: string, adjustments: Adjustments) => void,
): AdjustController {
	const saved = layer?.adjustments ?? neutralAdjustments;
	const values = useSharedValue(saved);
	const held = useSharedValue(false);
	const [chosen, choose] = useState<AdjustmentKey>("brightness");

	useLayoutEffect(() => {
		// On web, worklets run on the JS thread anyway, and scheduling one there
		// waits for the next frame.
		if (Platform.OS === "web") syncAdjustments(values, held, saved);
		else scheduleOnUI(syncAdjustments, values, held, saved);
	}, [values, held, saved]);

	const matrix = useDerivedValue(() => adjustmentMatrix(values.value));
	const dialValue = useDerivedValue(
		() => values.value[chosen] * ADJUST_DIAL_MAX,
		[chosen],
	);

	const layerId = layer?.id;
	const commit = useCallback(
		(adjustments: Adjustments) => {
			if (layerId !== undefined) setAdjustments(layerId, adjustments);
		},
		[layerId, setAdjustments],
	);
	const begin = useCallback(() => {
		"worklet";
		held.value = true;
	}, [held]);
	const change = useCallback(
		(percent: number) => {
			"worklet";
			values.value = { ...values.value, [chosen]: percent / ADJUST_DIAL_MAX };
		},
		[values, chosen],
	);
	const end = useCallback(() => {
		"worklet";
		held.value = false;
		scheduleOnRN(commit, values.value);
	}, [held, values, commit]);

	return {
		matrix,
		chosen,
		choose,
		dialValue,
		begin,
		change,
		end,
		changing: held,
	};
}
