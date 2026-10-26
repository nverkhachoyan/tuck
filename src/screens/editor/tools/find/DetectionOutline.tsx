import { Group, Path, Rect, rect, Skia } from "@shopify/react-native-skia";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import type { RedactionBoxPlacement } from "@/model/layers/redaction";
import { toTransformList } from "@/render/layerTransform";
import { colors } from "@/ui/theme";
import { useScreenPixels } from "../../canvas/SelectionOverlay";

// A detected region's check mark's radius, in screen pixels: a share of the
// region's shorter side on screen, within these bounds, so marks on small
// faces don't cover them or each other. A region narrower than
// `MARKER_HIDDEN_BELOW_PX` gets none: its fill and outline show its state.
const MARKER_MIN_PX = 4;
const MARKER_MAX_PX = 8;
const MARKER_SHARE = 0.2;
const MARKER_HIDDEN_BELOW_PX = 12;

export type DetectionOverlayRegion = RedactionBoxPlacement & {
	sourceIndex: number;
	selected: boolean;
};

/**
 * A temporary detector proposal, outlined until the user applies it, with a
 * mark in its corner that's checked while it's chosen.
 */
export function DetectionOutline({
	region,
	viewScale,
}: {
	region: DetectionOverlayRegion;
	viewScale: DerivedValue<number>;
}) {
	const { width, height, transform, selected } = region;
	const box = rect(-width / 2, -height / 2, width, height);
	const marker = useDerivedValue(() => {
		const disc = Skia.PathBuilder.Make();
		const check = Skia.PathBuilder.Make();
		const shortSide = Math.min(width, height) * viewScale.value;
		if (shortSide < MARKER_HIDDEN_BELOW_PX) {
			return { disc: disc.build(), check: check.build() };
		}
		const px = Math.min(
			MARKER_MAX_PX,
			Math.max(MARKER_MIN_PX, shortSide * MARKER_SHARE),
		);
		const radius = px / viewScale.value;
		const x = width / 2 - radius * 0.2;
		const y = -height / 2 + radius * 0.2;
		disc.addCircle(x, y, radius);
		check.moveTo(x - radius * 0.42, y);
		check.lineTo(x - radius * 0.1, y + radius * 0.34);
		check.lineTo(x + radius * 0.48, y - radius * 0.34);
		return { disc: disc.build(), check: check.build() };
	}, [viewScale, width, height]);
	const disc = useDerivedValue(() => marker.value.disc);
	const check = useDerivedValue(() => marker.value.check);
	const outline = useScreenPixels(viewScale, selected ? 2 : 1.25);
	const ring = useScreenPixels(viewScale, 1.25);
	const tick = useScreenPixels(viewScale, 2);
	return (
		<Group transform={toTransformList(transform)}>
			<Rect
				rect={box}
				color={selected ? colors.selectionSoft : "rgba(0, 0, 0, 0.18)"}
			/>
			<Rect
				rect={box}
				color={selected ? colors.selection : colors.textSecondary}
				style="stroke"
				strokeWidth={outline}
			/>
			<Path path={disc} color={selected ? colors.selection : colors.surface} />
			<Path
				path={disc}
				color={selected ? colors.selection : colors.textSecondary}
				style="stroke"
				strokeWidth={ring}
			/>
			{selected && (
				<Path
					path={check}
					color={colors.onSelection}
					style="stroke"
					strokeWidth={tick}
					strokeCap="round"
					strokeJoin="round"
				/>
			)}
		</Group>
	);
}
