import { useMemo, useState } from "react";
import type { CanvasInput } from "../../canvas/canvasInput";
import {
	type MaskEdge,
	type MaskEdgeKey,
	neutralMaskEdge,
} from "../../layers/image/mask";
import { useStore } from "../../store";
import type { ToolEnv } from "../defineTool";

export type EdgeController = ReturnType<typeof useEdgeTool>;

/**
 * Standalone Edge tool on `image` (cut-out photo, transparent PNG/sticker, or
 * opaque photo): edits `layer.maskEdge` live over the real composite, with
 * Cancel taking the session back and Done collapsing it into one undo step.
 */
export function useEdgeTool({ image: layer }: Pick<ToolEnv, "image">) {
	const { setMaskEdge } = useStore((state) => state.actions);
	const [chosen, choose] = useState<MaskEdgeKey>("smooth");
	const layerId = layer?.id;

	const canvasInput = useMemo(
		(): CanvasInput | null =>
			layerId === undefined ? null : { type: "view", imageId: layerId },
		[layerId],
	);

	return {
		edge: layer?.maskEdge,
		chosen,
		choose,
		setEdge:
			layerId !== undefined
				? (edge: MaskEdge, coalesce?: boolean) =>
						setMaskEdge(layerId, edge, coalesce)
				: undefined,
		reset:
			layer?.maskEdge && layerId !== undefined
				? () => setMaskEdge(layerId, neutralMaskEdge)
				: undefined,
		canvasInput,
	};
}
