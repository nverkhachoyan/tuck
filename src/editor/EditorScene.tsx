import {
	Fill,
	Group,
	Path,
	rect,
	Skia,
	useImage,
} from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { toTransformList } from "@/layers/layerTransform";
import { TextLayerView } from "@/layers/TextLayerView";
import { assertNever } from "@/lib/assertNever";
import type { EditorDocument, ImageLayer, Layer } from "@/model/document";
import { colors } from "@/theme";
import type { LiveTransform } from "./liveTransform";
import { handleMetrics, handlesVisible } from "./selectionHandles";

const SELECTION_STROKE_PX = 1.5;

type EditorSceneProps = {
	document: EditorDocument;
	selectedLayerId: string | null;
	hiddenLayerId: string | null;
	// Screen pixels per document unit.
	viewScale: number;
	live: LiveTransform;
};

/**
 * The editor's counterpart to `ExportScene`: draws every layer in document
 * space, but loads images asynchronously, lets the selected layer follow
 * the live gesture values, fades whatever export will crop, and draws the
 * selection above everything.
 */
export function EditorScene({
	document,
	selectedLayerId,
	hiddenLayerId,
	viewScale,
	live,
}: EditorSceneProps) {
	return (
		<Group>
			{document.layers.map((layer) =>
				layer.hidden || layer.id === hiddenLayerId ? null : (
					<LiveLayer key={layer.id} layer={layer} live={live}>
						<LayerContent layer={layer} />
					</LiveLayer>
				),
			)}
			<Group clip={rect(0, 0, document.width, document.height)} invertClip>
				<Fill color={colors.background} opacity={0.7} />
			</Group>
			<CenterGuides document={document} viewScale={viewScale} live={live} />
			{selectedLayerId !== null && selectedLayerId !== hiddenLayerId && (
				<SelectionHandles live={live} viewScale={viewScale} />
			)}
		</Group>
	);
}

function LayerContent({ layer }: { layer: Layer }) {
	switch (layer.type) {
		case "image":
			return <AsyncImage layer={layer} />;
		case "text":
			return <TextLayerView layer={layer} />;
		default:
			return assertNever(layer);
	}
}

/** Draws nothing until the image has decoded. */
function AsyncImage({ layer }: { layer: ImageLayer }) {
	const image = useImage(layer.uri);
	if (!image) return null;
	return <ImageLayerView layer={layer} image={image} />;
}

/**
 * Positions a layer's content with its transform, except while a gesture is
 * moving it: then the gesture-driven values win over the document.
 */
function LiveLayer({
	layer,
	live,
	children,
}: {
	layer: Layer;
	live: LiveTransform;
	children: ReactNode;
}) {
	const transform = useDerivedValue(() => {
		const active = live.activeId.value === layer.id;
		const t = layer.transform;
		return toTransformList({
			x: active ? live.x.value : t.x,
			y: active ? live.y.value : t.y,
			rotation: active ? live.rotation.value : t.rotation,
			scaleX: active ? live.scale.value : t.scaleX,
			scaleY: active ? live.scale.value : t.scaleY,
		});
	}, [layer.id, layer.transform]);

	return <Group transform={transform}>{children}</Group>;
}

/** The document's center lines that the dragged layer has snapped onto. */
function CenterGuides({
	document,
	viewScale,
	live,
}: {
	document: EditorDocument;
	viewScale: number;
	live: LiveTransform;
}) {
	const { width, height } = document;
	const path = useDerivedValue(() => {
		const builder = Skia.PathBuilder.Make();
		if (live.centeredX.value) {
			builder.moveTo(width / 2, 0);
			builder.lineTo(width / 2, height);
		}
		if (live.centeredY.value) {
			builder.moveTo(0, height / 2);
			builder.lineTo(width, height / 2);
		}
		return builder.build();
	}, [width, height]);

	return (
		<Path
			path={path}
			color={colors.accent}
			style="stroke"
			strokeWidth={SELECTION_STROKE_PX / viewScale}
		/>
	);
}

/**
 * The selected layer's outline and its corner (scale) and knob (rotate)
 * handles, drawn from the live values so they follow gestures. The group
 * translates and rotates with the layer but doesn't scale: the scale moves
 * the corners instead, so handles stay the same size on screen.
 */
function SelectionHandles({
	live,
	viewScale,
}: {
	live: LiveTransform;
	viewScale: number;
}) {
	const transform = useDerivedValue(() =>
		toTransformList({
			x: live.x.value,
			y: live.y.value,
			rotation: live.rotation.value,
			scaleX: 1,
			scaleY: 1,
		}),
	);

	// The outline and the stem up to the knob as one path, and the corner
	// squares and knob as another.
	const shapes = useDerivedValue(() => {
		const lines = Skia.PathBuilder.Make();
		const handles = Skia.PathBuilder.Make();
		const box = {
			halfWidth: live.halfWidth.value,
			halfHeight: live.halfHeight.value,
		};
		const w = box.halfWidth * live.scale.value;
		const h = box.halfHeight * live.scale.value;
		lines.addRect(Skia.XYWHRect(-w, -h, w * 2, h * 2));
		if (!handlesVisible(box, live.scale.value, viewScale)) {
			return { lines: lines.build(), handles: handles.build() };
		}

		const size = handleMetrics.size / viewScale;
		const knobY = -h - handleMetrics.knobOffset / viewScale;
		const knobRadius = size * 0.6;
		for (const [x, y] of [
			[-w, -h],
			[w, -h],
			[w, h],
			[-w, h],
		]) {
			handles.addRect(Skia.XYWHRect(x - size / 2, y - size / 2, size, size));
		}
		handles.addCircle(0, knobY, knobRadius);
		lines.moveTo(0, -h);
		lines.lineTo(0, knobY + knobRadius);
		return { lines: lines.build(), handles: handles.build() };
	}, [viewScale]);
	const lines = useDerivedValue(() => shapes.value.lines);
	const handles = useDerivedValue(() => shapes.value.handles);

	const strokeWidth = SELECTION_STROKE_PX / viewScale;
	return (
		<Group transform={transform}>
			<Path
				path={lines}
				color={colors.accent}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
			<Path path={handles} color="#FFFFFF" />
			<Path
				path={handles}
				color={colors.accent}
				style="stroke"
				strokeWidth={strokeWidth}
			/>
		</Group>
	);
}
