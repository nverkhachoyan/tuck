import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { writeTemporaryPng } from "@/platform/temporaryFile";
import { usePreference } from "@/platform/usePreference";
import { errorMessage } from "@/ui/errorMessage";
import { showAlert } from "@/ui/showAlert";
import type { ToolStroke } from "../../canvas/canvasTool";
import type { CanvasInput } from "../../canvasInputFor";
import type { ToolEnv } from "../../defineTool";
import { findLayer } from "../../document/document";
import { visibleImageLayer } from "../../document/framing";
import type { ImageLayer } from "../../layers/image/image";
import {
	imagePointAt,
	isCutOut,
	removalOf,
	selectsNothing,
} from "../../layers/image/mask";
import { cutOutSticker, saveSticker } from "../../savedStickers/saveSticker";
import { useRedactLook } from "../../shell/useRedactLook";
import { useStore } from "../../store";
import { removedMask } from "./cutMask";
import {
	type CutTapMode,
	cutCanvasTool,
	cutToolInUse,
	parseCutSettings,
	stepCutSize,
} from "./cutSettings";
import { useCutOut } from "./useCutOut";
import { useCutRedaction } from "./useCutRedaction";

export type CutController = ReturnType<typeof useCutTool>;

/** What the phone's tray shows: the brush's options, or the Apply menu. */
export type CutTray = "brush" | "apply";

/**
 * Cut, on its `image` while it's open: its settings, kept between sessions,
 * the tool they and the device give, and selecting, inverting, clearing,
 * and redacting the selection, each undefined where it can't be done.
 * - The selection is the image's cut while Cut is open. An image that isn't
 *   cut opens selecting nothing.
 * - Done (`done`) only puts Cut down, leaving the image as it was: nothing
 *   happens to a selection until an action is chosen.
 * - A mask found after Cut was put down, or moved to another image, isn't
 *   wanted any more. Masks are kept through the host's `addImage`.
 * - A tap adds what's under it, or subtracts it, as `settings.tapMode`
 *   says; on web, holding Shift adds and holding Alt subtracts.
 * - `resize` steps the last tap's selection a size larger or smaller, while
 *   it's still the selection.
 * - The Apply menu's actions (`apply`), each undefined while nothing is
 *   selected: New layer copies the selection to a new layer above the
 *   image, selected, leaving the image whole; Keep only makes the selection
 *   the image's cut, replacing any it had; Remove hides
 *   the selection, taking it out of the cut the image had (`removalOf`);
 *   Redact adds a redaction in its shape, in the editor's redaction look,
 *   which is selected; and each closes Cut (`close`) as one undo step,
 *   with a notice (`notify`). Save sticker keeps what's selected as a saved
 *   sticker and leaves Cut open (`stickerSaved` until the selection
 *   changes). `applying` names the action running, while one runs.
 * - `tray` is what the phone's tray shows, set by `showInTray`.
 * - `stepSize` steps the brush's size for `[` and `]`, `canvasInput` paints
 *   or taps on a document of `documentSize`, while there's an image shown
 *   to cut, and `finishStroke` paints the selection, or selects what was
 *   tapped.
 */
export function useCutTool({
	image,
	documentSize,
	addImage,
	close,
	notify,
}: Pick<ToolEnv, "image" | "documentSize" | "addImage" | "close" | "notify">) {
	const layer = image ?? undefined;
	const key = useStore((state) => state.key);
	// The image as it was when Cut opened.
	const before = useStore((state) => {
		const found =
			layer && state.session && findLayer(state.session.document, layer.id);
		return found?.type === "image" ? found : undefined;
	});
	const {
		setMask,
		invertMask,
		cancelSession,
		commitSession,
		addMaskedRedaction,
		addCutCopy,
		paintMask,
	} = useStore((state) => state.actions);
	const [tray, showInTray] = useState<CutTray>("brush");
	const [applying, setApplying] = useState<"remove" | "saveSticker" | null>(
		null,
	);
	const applyingNow = useRef(false);
	const [savedSticker, setSavedSticker] = useState<ImageLayer | null>(null);
	const layerId = useRef<string | null>(null);
	layerId.current = layer?.id ?? null;
	// Saved under Cut out's key, so its settings carry over.
	const [settings, change] = usePreference("cutOut", parseCutSettings);
	const heldMode = useHeldTapMode();
	const { effectFor } = useRedactLook();
	const keep = (uri: string) => addImage(uri, false);
	const cutOut = useCutOut({
		key,
		image: layer,
		picking: settings.tool === "tap",
		latest: (id) => {
			const current = useStore.getState().document;
			return current ? visibleImageLayer(current, id) : undefined;
		},
		keep,
		onMask: (id, mask, keepStrokes) => {
			if (layerId.current === id) setMask(id, mask, { keepStrokes });
		},
		onInvert: (id, mask) => {
			if (layerId.current === id) invertMask(id, mask);
		},
	});
	const redaction = useCutRedaction({
		keep,
		onRedact: (id, mask, rect) => {
			if (layerId.current !== id) return;
			cancelSession();
			addMaskedRedaction(id, mask, rect, effectFor(documentSize));
			notify("Selection redacted");
			close();
		},
	});
	const cut = layer && isCutOut(layer) ? layer : undefined;
	const selected =
		layer && !selectsNothing(layer, cutOut.emptyMask) ? layer : undefined;
	const removal =
		before && selected ? removalOf(before, selected, cutOut.emptyMask) : null;
	const openedOnCut = before !== undefined && isCutOut(before);

	// Runs `task` unless another action is running, with an alert titled
	// `failed` if it throws.
	const runAction = async (
		action: "remove" | "saveSticker",
		failed: string,
		task: () => Promise<void>,
	) => {
		if (applyingNow.current) return;
		applyingNow.current = true;
		setApplying(action);
		try {
			await task();
		} catch (error) {
			showAlert(failed, errorMessage(error));
		} finally {
			applyingNow.current = false;
			setApplying(null);
		}
	};
	// Its Undo would take back an earlier change if the session made none.
	const notifyIfChanged = (message: string) => {
		const { document, session } = useStore.getState();
		if (document !== session?.document) notify(message);
	};
	const newLayer = (selection: ImageLayer) => {
		const { mask, maskStrokes } = selection;
		cancelSession();
		addCutCopy(selection.id, { mask, maskStrokes });
		notify("Selection copied to a new layer");
		close();
	};
	const keepOnly = () => {
		notifyIfChanged(openedOnCut ? "Cut updated" : "Kept only the selection");
		commitSession();
		close();
	};
	const remove = (from: ImageLayer | null, selection: ImageLayer) =>
		runAction("remove", "Couldn't remove the selection", async () => {
			const bytes = await removedMask(from, selection);
			const mask = await keep(writeTemporaryPng(bytes));
			if (layerId.current !== selection.id) return;
			cancelSession();
			setMask(selection.id, mask);
			notify("Selection removed");
			close();
		});
	const saveAsSticker = (selection: ImageLayer) =>
		runAction("saveSticker", "Couldn't save sticker", async () => {
			await saveSticker(await cutOutSticker(selection));
			setSavedSticker(selection);
			cutOut.announce("Saved as a sticker");
		});
	const { pickSize } = cutOut;
	const tool = cutToolInUse(settings, cutOut.canFind);
	const cutLayerId = layer?.id;
	const canvasInput = useMemo(
		(): CanvasInput | null =>
			cutLayerId === undefined
				? null
				: {
						type: "tool",
						tool: cutCanvasTool(cutLayerId, settings, tool, documentSize),
					},
		[cutLayerId, settings, tool, documentSize],
	);

	return {
		layer,
		settings,
		change,
		tool,
		canvasInput,
		// A sub-tool with no size, like Tap, leaves the settings alone.
		stepSize: (step: 1 | -1) => {
			const next = stepCutSize(settings, tool, step);
			if (next !== settings) change(next);
		},
		setTapMode: (tapMode: CutTapMode) => change({ ...settings, tapMode }),
		news: cutOut.news,
		finding: cutOut.finding,
		inverting: cutOut.inverting,
		findAll:
			cutOut.canFind && layer ? () => void cutOut.findAll(layer) : undefined,
		resize:
			layer && pickSize && layer.mask === pickSize.mask
				? {
						index: pickSize.index,
						count: pickSize.count,
						step: (step: 1 | -1) => void cutOut.resize(layer, step),
					}
				: undefined,
		invert: cut ? () => void cutOut.invert(cut) : undefined,
		apply: {
			newLayer: selected ? () => newLayer(selected) : undefined,
			keepOnly: selected ? keepOnly : undefined,
			remove: removal
				? () => void remove(removal.from, removal.selection)
				: undefined,
			redact: selected ? () => void redaction.redact(selected) : undefined,
			saveSticker: selected ? () => void saveAsSticker(selected) : undefined,
		},
		applying: redaction.busy ? ("redact" as const) : applying,
		stickerSaved:
			selected !== undefined &&
			savedSticker?.id === selected.id &&
			savedSticker.mask === selected.mask &&
			savedSticker.maskStrokes === selected.maskStrokes,
		tray,
		showInTray,
		reset: selected ? () => void cutOut.clear(selected, true) : undefined,
		// Opened on `image`, which this render doesn't show yet: one that
		// isn't cut yet starts selecting nothing; one that is starts
		// selecting what its cut keeps.
		start: (image: ImageLayer) => {
			if (isCutOut(image)) return;
			layerId.current = image.id;
			void cutOut.clear(image, false);
		},
		done: cancelSession,
		finishStroke: (stroke: ToolStroke) => {
			switch (stroke.type) {
				case "cutBrush": {
					// Undone back past the empty selection, an image paints one
					// first, since a pen adds only to a cut.
					const empty = cutOut.emptyMask;
					if (stroke.brush.type === "pen" && layer && !cut && empty) {
						setMask(layer.id, empty);
					}
					paintMask(stroke.layerId, { ...stroke.brush, points: stroke.points });
					break;
				}
				case "pickSubject": {
					const at = layer && imagePointAt(layer, stroke.point);
					const mode = heldMode.current ?? settings.tapMode;
					if (layer && at) void cutOut.pick(layer, at, mode === "add");
					break;
				}
			}
		},
	};
}

/**
 * Which way a tap goes while a key is held on web: Shift adds, and Alt
 * subtracts. Null otherwise, and once the window loses focus.
 */
function useHeldTapMode() {
	const held = useRef<CutTapMode | null>(null);
	useEffect(() => {
		// Native has a `window`, but no events on it.
		if (Platform.OS !== "web") return;
		const read = (event: KeyboardEvent) => {
			held.current = event.altKey ? "subtract" : event.shiftKey ? "add" : null;
		};
		const forget = () => {
			held.current = null;
		};
		window.addEventListener("keydown", read);
		window.addEventListener("keyup", read);
		window.addEventListener("blur", forget);
		return () => {
			window.removeEventListener("keydown", read);
			window.removeEventListener("keyup", read);
			window.removeEventListener("blur", forget);
		};
	}, []);
	return held;
}
