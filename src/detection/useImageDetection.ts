import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/errorMessage";
import {
	type DetectionFeature,
	type DetectionRect,
	detectImageRegions,
	isDetectionAvailable,
	isDetectionModelDownloading,
} from "./imageDetection";

export type ImageDetectionState =
	| { status: "idle" }
	| { status: "working"; feature: DetectionFeature }
	| {
			status: "found";
			feature: DetectionFeature;
			regions: DetectionRect[];
			selected: ReadonlySet<number>;
	  }
	| { status: "empty"; feature: DetectionFeature }
	| { status: "unavailable"; feature: DetectionFeature }
	| { status: "downloading"; feature: DetectionFeature }
	| { status: "failed"; feature: DetectionFeature; message: string };

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

	const start = useCallback(async (feature: DetectionFeature, uri: string) => {
		if (!isDetectionAvailable(feature)) {
			setState({ status: "unavailable", feature });
			return;
		}
		const current = request.current + 1;
		request.current = current;
		setState({ status: "working", feature });
		try {
			const regions = await detectImageRegions(feature, uri);
			if (request.current !== current) return;
			setState(
				regions.length === 0
					? { status: "empty", feature }
					: {
							status: "found",
							feature,
							regions,
							selected: new Set(regions.map((_, index) => index)),
						},
			);
		} catch (error) {
			if (request.current !== current) return;
			setState(
				isDetectionModelDownloading(error)
					? { status: "downloading", feature }
					: { status: "failed", feature, message: errorMessage(error) },
			);
		}
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
