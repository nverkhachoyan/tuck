import { Group, Path, Rect, Skia, useImage } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { ImageLayerView } from "@/layers/ImageLayerView";
import { layerBounds } from "@/layers/layerBounds";
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
 * the live gesture values, and draws its handles above everything.
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
					<LiveLayer
						key={layer.id}
						layer={layer}
						viewScale={viewScale}
						live={live}
						selected={layer.id === selectedLayerId}
					>
						<LayerContent layer={layer} />
					</LiveLayer>
				),
			)}
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
 * moving it: then the gesture-driven values win over the document. Draws the
 * selection outline over the selected layer.
 */
function LiveLayer({
	layer,
	viewScale,
	live,
	selected,
	children,
}: {
	layer: Layer;
	viewScale: number;
	live: LiveTransform;
	selected: boolean;
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

	// Keep the selection outline a constant on-screen thickness at any scale.
	const selectionStroke = useDerivedValue(() => {
		const scale =
			live.activeId.value === layer.id
				? live.scale.value
				: layer.transform.scaleX;
		return SELECTION_STROKE_PX / (viewScale * scale);
	}, [layer.id, layer.transform, viewScale]);

	const box = selected ? layerBounds(layer) : null;
	return (
		<Group transform={transform}>
			{children}
			{box && (
				<Rect
					x={-box.halfWidth}
					y={-box.halfHeight}
					width={box.halfWidth * 2}
					height={box.halfHeight * 2}
					color={colors.accent}
					style="stroke"
					strokeWidth={selectionStroke}
				/>
			)}
		</Group>
	);
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
 * The selected layer's corner (scale) and knob (rotate) handles, drawn from
 * the live values so they follow gestures. The group translates and rotates
 * with the layer but doesn't scale: the scale moves the corners instead, so
 * handles stay the same size on screen.
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

	// The corner squares and knob as one path, and the stem up to the knob.
	const shapes = useDerivedValue(() => {
		const handles = Skia.PathBuilder.Make();
		const stem = Skia.PathBuilder.Make();
		const box = {
			halfWidth: live.halfWidth.value,
			halfHeight: live.halfHeight.value,
		};
		if (!handlesVisible(box, live.scale.value, viewScale)) {
			return { handles: handles.build(), stem: stem.build() };
		}

		const w = box.halfWidth * live.scale.value;
		const h = box.halfHeight * live.scale.value;
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
		stem.moveTo(0, -h);
		stem.lineTo(0, knobY + knobRadius);
		return { handles: handles.build(), stem: stem.build() };
	}, [viewScale]);
	const handles = useDerivedValue(() => shapes.value.handles);
	const stem = useDerivedValue(() => shapes.value.stem);

	const strokeWidth = SELECTION_STROKE_PX / viewScale;
	return (
		<Group transform={transform}>
			<Path
				path={stem}
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
