import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import {
	type DetectionFeature,
	type DetectionRect,
	detectImageRegions,
	isDetectionAvailable,
	isDetectionModelDownloading,
} from "../../detection/imageDetection";

export type DetectedRegion = DetectionRect & { feature: DetectionFeature };
export type DetectionScope = DetectionFeature | "both";

type DetectionIssue = {
	feature: DetectionFeature;
	message: string;
};

export type ImageDetectionState =
	| { status: "idle" }
	| { status: "working"; scope: DetectionScope }
	| {
			status: "found";
			scope: DetectionScope;
			regions: DetectedRegion[];
			selected: ReadonlySet<number>;
			issues: DetectionIssue[];
	  }
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
						selected: new Set(regions.map((_, index) => index)),
					},
		);
	}, []);

	const select = useCallback((indices: Iterable<number>) => {
		setState((current) =>
			current.status === "found"
				? { ...current, selected: new Set(indices) }
				: current,
		);
	}, []);

	const toggle = useCallback((index: number) => {
		setState((current) => {
			if (current.status !== "found") return current;
			const selected = new Set(current.selected);
			if (selected.has(index)) selected.delete(index);
			else selected.add(index);
			return { ...current, selected };
		});
	}, []);

	return { state, start, select, toggle, reset };
}
