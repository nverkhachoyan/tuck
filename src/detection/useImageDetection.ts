import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/errorMessage";
import {
	type DetectionFeature,
	type DetectionRect,
	detectImageRegions,
	isDetectionAvailable,
	isDetectionModelDownloading,
} from "./imageDetection";

export type DetectedRegion = DetectionRect & { feature: DetectionFeature };

type DetectionIssue = {
	feature: DetectionFeature;
	message: string;
};

export type ImageDetectionState =
	| { status: "idle" }
	| { status: "working" }
	| {
			status: "found";
			regions: DetectedRegion[];
			selected: ReadonlySet<number>;
			issues: DetectionIssue[];
	  }
	| { status: "empty"; issues: DetectionIssue[] };

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

	const start = useCallback(async (uri: string) => {
		const current = request.current + 1;
		request.current = current;
		setState({ status: "working" });
		const regions: DetectedRegion[] = [];
		const issues: DetectionIssue[] = [];
		// These libraries are both expensive on web, so run one at a time.
		for (const feature of ["faces", "text"] as const) {
			if (!isDetectionAvailable(feature)) {
				issues.push({
					feature,
					message: `${feature === "faces" ? "Face" : "Text"} finding isn't available on this device.`,
				});
				continue;
			}
			try {
				const found = await detectImageRegions(feature, uri);
				regions.push(...found.map((region) => ({ ...region, feature })));
			} catch (error) {
				issues.push({
					feature,
					message: isDetectionModelDownloading(error)
						? `${feature === "faces" ? "Face" : "Text"} finding is still downloading.`
						: `${feature === "faces" ? "Face" : "Text"} finding failed: ${errorMessage(error)}`,
				});
			}
		}
		if (request.current !== current) return;
		setState(
			regions.length === 0
				? { status: "empty", issues }
				: {
						status: "found",
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
