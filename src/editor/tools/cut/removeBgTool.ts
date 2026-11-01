import { useRef, useState } from "react";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import { defineTool, type ToolEnv } from "../../defineTool";
import {
	isCutOutAvailable,
	isSubjectModelDownloading,
} from "../../detection/subjectDetection";
import { visibleImageLayer } from "../../document/framing";
import type { ImageLayer } from "../../layers/image/image";
import { useStore } from "../../store";
import { removeBgSpec } from "./removeBgSpec";
import { subjectMaskOf } from "./useCutOut";

export type RemoveBgController = ReturnType<typeof useRemoveBg>;

/**
 * Remove BG: cuts an image down to its subjects as one undo step, replacing
 * any cut it had, with a notice that offers Refine, which opens Cut on it.
 * - Subjects found by Cut in the same session are used again
 *   (`subjectMaskOf`), and its masks are kept through the host's
 *   `addImage`.
 * - An alert says when there's no subject, the model is still downloading,
 *   or this device can't find subjects.
 * - `busy` while it runs; another press meanwhile does nothing.
 */
function useRemoveBg({
	addImage,
	notify,
	startTool,
}: Pick<ToolEnv, "addImage" | "notify" | "startTool">) {
	const key = useStore((state) => state.key);
	const { setMask } = useStore((state) => state.actions);
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const latest = (id: string) => {
		const current = useStore.getState().document;
		return current ? visibleImageLayer(current, id) : undefined;
	};

	const run = async (image: ImageLayer) => {
		if (running.current) return;
		if (!isCutOutAvailable()) {
			showAlert(
				"Can't remove the background",
				"This device can't find the subject of a photo.",
			);
			return;
		}
		running.current = true;
		setBusy(true);
		try {
			const mask = await subjectMaskOf(key, image.uri, (uri) =>
				addImage(uri, false),
			);
			if (mask === null) {
				showAlert(
					"Nothing to remove",
					"There's no clear subject in front of the background.",
				);
				return;
			}
			// Gone or hidden meanwhile, it has no background to remove.
			if (!latest(image.id)) return;
			const before = useStore.getState().document;
			setMask(image.id, mask);
			// Already cut this way, there's nothing for Undo to take back.
			if (useStore.getState().document === before) return;
			notify("Background removed", {
				label: "Refine",
				onPress: () => {
					const current = latest(image.id);
					if (current) startTool("cut", current);
				},
			});
		} catch (error) {
			showAlert(
				"Couldn't remove the background",
				isSubjectModelDownloading(error)
					? "Remove BG is still downloading. Try again in a moment."
					: errorMessage(error),
			);
		} finally {
			running.current = false;
			setBusy(false);
		}
	};

	return { busy, run };
}

export const removeBgTool = defineTool<RemoveBgController>({
	spec: removeBgSpec,
	useController: useRemoveBg,
	views: {},
	available: () => isCutOutAvailable(),
	run: (removeBg, image) => void removeBg.run(image),
	busy: (removeBg) => removeBg.busy,
});
