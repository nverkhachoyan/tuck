import { useStore } from "@/store";

/**
 * The editor screen's actions on the shared store. Each is selected on its
 * own; actions never change, so selecting one re-renders nothing, and the
 * returned object is cheap to rebuild each render.
 */
export function useEditorActions() {
	return {
		addImageLayer: useStore((state) => state.addImageLayer),
		addStickerLayer: useStore((state) => state.addStickerLayer),
		duplicateSelectedLayer: useStore((state) => state.duplicateSelectedLayer),
		drawStroke: useStore((state) => state.drawStroke),
		addRedactionBox: useStore((state) => state.addRedactionBox),
		setLayerGroupHidden: useStore((state) => state.setLayerGroupHidden),
		setLayerGroupLocked: useStore((state) => state.setLayerGroupLocked),
		deleteLayerGroup: useStore((state) => state.deleteLayerGroup),
		paintRedaction: useStore((state) => state.paintRedaction),
		addShape: useStore((state) => state.addShape),
		setAdjustments: useStore((state) => state.setAdjustments),
		setMask: useStore((state) => state.setMask),
		paintMask: useStore((state) => state.paintMask),
		transformLayer: useStore((state) => state.transformLayer),
		resizeBox: useStore((state) => state.resizeBox),
		nudgeLayer: useStore((state) => state.nudgeLayer),
		moveLayer: useStore((state) => state.moveLayer),
		setLayerHidden: useStore((state) => state.setLayerHidden),
		setLayerLocked: useStore((state) => state.setLayerLocked),
		setLayerResizable: useStore((state) => state.setLayerResizable),
		setBackground: useStore((state) => state.setBackground),
		reframe: useStore((state) => state.reframe),
		deleteLayer: useStore((state) => state.deleteLayer),
		selectLayer: useStore((state) => state.selectLayer),
		undo: useStore((state) => state.undo),
		redo: useStore((state) => state.redo),
		beginSession: useStore((state) => state.beginSession),
		commitSession: useStore((state) => state.commitSession),
		cancelSession: useStore((state) => state.cancelSession),
	};
}

export type EditorActions = ReturnType<typeof useEditorActions>;
