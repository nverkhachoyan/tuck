import { useRef } from "react";
import { imagePointAt, isCutOut } from "@/model/cutout";
import { visibleImageLayer } from "@/model/framing";
import type { Point, Rect } from "@/model/geometry";
import type { ImageLayer } from "@/model/layers/image";
import { usePreference } from "@/platform/usePreference";
import { addImage } from "@/projects/projectService";
import { useStore } from "@/store";
import { cutOutTool, parseCutOutSettings, stepCutSize } from "./cutOutSettings";
import { useCutOut } from "./useCutOut";
import { useCutRedaction } from "./useCutRedaction";

/**
 * Cut out, on the image `layer` while it's open: its settings, kept between
 * sessions, the tool they and the device give, and finding, picking,
 * inverting, resetting, and redacting the cut, each undefined where it
 * can't be done. A mask found after Cut out was put down, or moved to
 * another image, isn't wanted any more. Redacting the cut's selection
 * hands `onRedact` a mask file of what the cut keeps and the part of the
 * image it covers. `stepSize` steps the brush's size for `[` and `]`.
 */
export type CutOutController = ReturnType<typeof useCutOutTool>;

export function useCutOutTool({
	layer,
	onRedact,
}: {
	layer: ImageLayer | undefined;
	onRedact: (layerId: string, mask: string, rect: Rect) => void;
}) {
	const projectId = useStore((state) => state.projectId);
	const { setMask, invertMask } = useStore((state) => state.actions);
	const layerId = useRef<string | null>(null);
	layerId.current = layer?.id ?? null;
	const [settings, change] = usePreference("cutOut", parseCutOutSettings);
	// The mask moves into the project, so autosave knows its file.
	const keep = async (uri: string) =>
		projectId === null ? uri : addImage(projectId, uri, false);
	const cutOut = useCutOut({
		projectId,
		image: layer,
		picking: settings.tool === "pick",
		latest: (id) => {
			const current = useStore.getState().document;
			return current ? visibleImageLayer(current, id) : undefined;
		},
		keep,
		onMask: (id, mask, picked) => {
			if (layerId.current === id) setMask(id, mask, { keepStrokes: picked });
		},
		onInvert: (id, mask) => {
			if (layerId.current === id) invertMask(id, mask);
		},
	});
	const redaction = useCutRedaction({
		keep,
		onRedact: (id, mask, rect) => {
			if (layerId.current === id) onRedact(id, mask, rect);
		},
	});
	const cut = layer && isCutOut(layer) ? layer : undefined;
	const tool = cutOutTool(settings, cutOut.canFind);

	return {
		layer,
		settings,
		change,
		tool,
		// A sub-tool with no size, like Pick, leaves the settings alone.
		stepSize: (step: 1 | -1) => {
			const next = stepCutSize(settings, tool, step);
			if (next !== settings) change(next);
		},
		news: cutOut.news,
		finding: cutOut.finding,
		inverting: cutOut.inverting,
		redacting: redaction.busy,
		findAll:
			cutOut.canFind && layer ? () => void cutOut.find(layer) : undefined,
		invert: cut ? () => void cutOut.invert(cut) : undefined,
		redact: cut ? () => void redaction.redact(cut) : undefined,
		reset: cut ? () => setMask(cut.id, null) : undefined,
		// Opened on `image`, which this render doesn't show yet: one that
		// isn't cut yet has its subjects cut out at once, so one tap still
		// does it; one that is opens to refine its cut.
		start: (image: ImageLayer) => {
			if (!cutOut.canFind || isCutOut(image)) return;
			layerId.current = image.id;
			void cutOut.find(image);
		},
		// A tap on the image being cut out cuts out only the subject there.
		pickSubject: (point: Point) => {
			const at = layer && imagePointAt(layer, point);
			if (layer && at) void cutOut.find(layer, at);
		},
	};
}
