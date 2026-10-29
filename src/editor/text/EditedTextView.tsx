import { clampSelection } from "@tuck/skia-text-input";
import { useEffect, useMemo } from "react";
import {
	cancelAnimation,
	type DerivedValue,
	useDerivedValue,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { Group, Paint, Path, Rect, rect, Skia } from "react-native-skia";
import { type TextLayer, withPlaceholder } from "@/model/layers/text";
import { TextLayerView } from "@/render/layers/TextLayerView";
import { textCaretRect, textSelectionRects } from "@/render/textLayerLayout";
import { colors } from "@/ui/theme";
import { SELECTION_HALO } from "../canvas/SelectionOverlay";
import type { TextEditState } from "../editorMode";

// A caret's width, and its halo's on each side, in screen pixels, and how
// long it stays on, then off, as it blinks.
const CARET_PX = 2;
const CARET_HALO_PX = 1;
const CARET_BLINK_MS = 530;
// Faint enough to read as a hint rather than text that's there.
const PLACEHOLDER_OPACITY = 0.45;
// Over the text rather than under it, where a box would hide it.
const TEXT_SELECTION = "rgba(88, 166, 255, 0.4)";

/**
 * Text being edited, in its layer's space: what's typed so far, with the
 * selection over it, or the caret, blinking while it holds still. Empty, it
 * shows the placeholder, faded, with the caret at its start.
 */
export function EditedTextView({
	edit,
	viewScale,
}: {
	edit: TextEditState;
	viewScale: DerivedValue<number>;
}) {
	const { layer, focused } = edit;
	const shown = useMemo(() => withPlaceholder(layer), [layer]);
	const selection = clampSelection(edit.selection, layer.text.length);
	const collapsed = selection.start === selection.end;
	// One screen pixel, across the layer, in its own units.
	const { scaleX } = layer.transform;
	const pixel = useDerivedValue(
		() => 1 / (viewScale.value * scaleX),
		[viewScale, scaleX],
	);
	let highlight = null;
	if (!collapsed) {
		const builder = Skia.PathBuilder.Make();
		for (const box of textSelectionRects(layer, selection)) {
			builder.addRect(Skia.XYWHRect(box.x, box.y, box.width, box.height));
		}
		highlight = builder.build();
	}
	return (
		<>
			{shown === layer ? (
				<TextLayerView layer={layer} />
			) : (
				// A layer, faded as a whole: a paragraph keeps its own paints, which
				// a group's opacity doesn't reach.
				<Group layer={<Paint opacity={PLACEHOLDER_OPACITY} />}>
					<TextLayerView layer={shown} />
				</Group>
			)}
			{highlight && <Path path={highlight} color={TEXT_SELECTION} />}
			{focused && collapsed && (
				<Caret
					layer={shown}
					index={selection.start}
					pixel={pixel}
					key={`${selection.start}:${layer.text}`}
				/>
			)}
		</>
	);
}

/**
 * A text caret before `index`, `pixel` being a screen pixel in the layer's
 * units. It blinks from the moment it mounts: keyed by where it is and the
 * text, so it holds still while it moves and while typing.
 */
function Caret({
	layer,
	index,
	pixel,
}: {
	layer: TextLayer;
	index: number;
	pixel: DerivedValue<number>;
}) {
	const { x, y, height } = textCaretRect(layer, index);
	const bar = useDerivedValue(() => {
		const width = CARET_PX * pixel.value;
		return rect(x - width / 2, y, width, height);
	}, [pixel, x, y, height]);
	const halo = useDerivedValue(() => {
		const margin = CARET_HALO_PX * pixel.value;
		const width = CARET_PX * pixel.value + margin * 2;
		return rect(x - width / 2, y - margin, width, height + margin * 2);
	}, [pixel, x, y, height]);
	const opacity = useSharedValue(1);
	useEffect(() => {
		opacity.value = withSequence(
			withTiming(1, { duration: 0 }),
			withRepeat(
				withSequence(
					withDelay(CARET_BLINK_MS, withTiming(0, { duration: 0 })),
					withDelay(CARET_BLINK_MS, withTiming(1, { duration: 0 })),
				),
				-1,
			),
		);
		return () => cancelAnimation(opacity);
	}, [opacity]);
	return (
		<Group opacity={opacity}>
			<Rect rect={halo} color={SELECTION_HALO} />
			<Rect rect={bar} color={colors.selection} />
		</Group>
	);
}
