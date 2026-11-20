import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/ui/errorMessage";
import {
	type DetectionFeature,
	type DetectionRegion,
	detectImageRegions,
	isDetectionAvailable,
	isDetectionModelDownloading,
} from "../../detection/imageDetection";
import { chooseWhole, type FindChoice, tapChoice } from "./findResults";

export type DetectedRegion = DetectionRegion & { feature: DetectionFeature };
export type DetectionScope = DetectionFeature | "both";

type DetectionIssue = {
	feature: DetectionFeature;
	message: string;
};

export type ImageDetectionState =
	| { status: "idle" }
	| { status: "working"; scope: DetectionScope }
	| ({
			status: "found";
			scope: DetectionScope;
			regions: DetectedRegion[];
			issues: DetectionIssue[];
	  } & FindChoice)
	| { status: "empty"; scope: DetectionScope; issues: DetectionIssue[] };

const FEATURE_NAMES: Record<DetectionFeature, string> = {
	faces: "Face",
	text: "Text",
};

/** What finding `feature` in the image at `uri` found, or why it couldn't. */
async function detectFeature(
	feature: DetectionFeature,
	uri: string,
): Promise<DetectedRegion[] | DetectionIssue> {
	const name = FEATURE_NAMES[feature];
	if (!isDetectionAvailable(feature)) {
		return {
			feature,
			message: `${name} finding isn't available on this device.`,
		};
	}
	try {
		const found = await detectImageRegions(feature, uri);
		return found.map((region) => ({ ...region, feature }));
	} catch (error) {
		return {
			feature,
			message: isDetectionModelDownloading(error)
				? `${name} finding is still downloading.`
				: `${name} finding failed: ${errorMessage(error)}`,
		};
	}
}

export function useImageDetection(targetKey: string) {
	const [state, setState] = useState<ImageDetectionState>({ status: "idle" });
	const request = useRef(0);

	const reset = useCallback(() => {
		request.current += 1;
		setState({ status: "idle" });
	}, []);

	useEffect(() => {
		void targetKey;
		reset();
	}, [targetKey, reset]);

	const start = useCallback(async (uri: string, scope: DetectionScope) => {
		const current = request.current + 1;
		request.current = current;
		setState({ status: "working", scope });
		const regions: DetectedRegion[] = [];
		const issues: DetectionIssue[] = [];
		// These libraries are both expensive on web, so run one at a time.
		const features: DetectionFeature[] =
			scope === "both" ? ["faces", "text"] : [scope];
		for (const feature of features) {
			const result = await detectFeature(feature, uri);
			if ("message" in result) issues.push(result);
			else regions.push(...result);
		}
		if (request.current !== current) return;
		setState(
			regions.length === 0
				? { status: "empty", scope, issues }
				: {
						status: "found",
						scope,
						regions,
						issues,
						// A face found is nearly always wanted; which lines of text
						// are private is the user's to pick.
						...chooseWhole(
							regions.flatMap((region, index) =>
								region.feature === "faces" ? [index] : [],
							),
						),
					},
		);
	}, []);

	const select = useCallback((indices: Iterable<number>) => {
		setState((current) =>
			current.status === "found"
				? { ...current, ...chooseWhole(indices) }
				: current,
		);
	}, []);

	// A tap on region `index`, and on its word `word` if any (`tapChoice`).
	const tap = useCallback((index: number, word: number | null) => {
		setState((current) =>
			current.status === "found"
				? { ...current, ...tapChoice(current, index, word) }
				: current,
		);
	}, []);

	return { state, start, select, tap, reset };
}
