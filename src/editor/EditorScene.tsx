import type { ReactNode } from "react";
import { type DerivedValue, useDerivedValue } from "react-native-reanimated";
import { Fill, Group, Rect, rect, Shadow } from "react-native-skia";
import { colorScheme, colors } from "@/ui/theme";
import { CanvasBackground } from "./canvas/Checkerboard";
import {
	type LiveStroke,
	NewLayerStroke,
	StrokeTarget,
} from "./canvas/LiveStrokeOverlay";
import type { LiveTransform } from "./canvas/liveTransform";
import { type CanvasRegion, RegionOutline } from "./canvas/RegionOutline";
import {
	SelectionHandles,
	SelectionOutline,
	SnapGuides,
	useScreenPixels,
} from "./canvas/SelectionOverlay";
import type { LiveAdjustment } from "./canvasInputFor";
import type { EditorDocument } from "./document/document";
import type { Layer } from "./layers/layer";
import { toTransformList } from "./layers/layerTransform";

// The canvas's shadows on the table around it, as a print's: a tight one
// where it touches and a soft one that lifts it, in screen pixels. At night,
// where a shadow barely shows, a hairline edge keeps a black canvas visible.
const CONTACT_OFFSET_PX = 1;
const CONTACT_BLUR_PX = 1.5;
const LIFT_OFFSET_PX = 8;
const LIFT_BLUR_PX = 14;
const EDGE_PX = 1;
const showEdge = colorScheme === "dark";

/**
 * A layer the open tool is editing in place (its definition's `draft`):
 * `layer` as placed, which the scene draws with `render` in place of the
 * document's, or on top of the layers when `isNew`.
 */
export type SceneDraft = {
	layer: Layer;
	isNew: boolean;
	render: (viewScale: DerivedValue<number>) => ReactNode;
};

type EditorSceneProps = {
	document: EditorDocument;
	selectedLayerId: string | null;
	draft: SceneDraft | null;
	// Screen pixels per document unit, as shown: it follows a zoom as it goes.
	viewScale: DerivedValue<number>;
	// The same once the view settles, for what's too costly to draw again on
	// every frame of a zoom (the checkerboard).
	settledScale: number;
	live: LiveTransform;
	stroke: LiveStroke | null;
	// Outlined without handles, as a tool's target: it holds still.
	outlinedLayer: Layer | null;
	adjusting: LiveAdjustment | null;
	// The image being cut out, which shows what it cuts away faintly.
	cuttingOutId: string | null;
	// What a `regions` input shows over the canvas.
	regions: readonly CanvasRegion[];
	// An image layer's file couldn't be read or decoded. Must be stable.
	onImageError: (error: unknown) => void;
};

/**
 * The editor's counterpart to `DocumentRenderScene`: draws every layer in document
 * space, but loads images asynchronously, lets the selected layer follow
 * the live gesture values, fades whatever export will crop, and draws the
 * selection above everything. A transparent canvas shows a checkerboard.
 *
 * A locked image is cut off at the canvas's edge, like a crop. Once unlocked
 * it moves like any layer, so it fades past the edge instead. The canvas
 * sits on the table like a print, with a shadow around it.
 *
 * What's sized in screen pixels (outlines, handles, the shadow) keeps its
 * size on screen at any zoom, following `viewScale` on the UI thread.
 */
export function EditorScene({
	document,
	selectedLayerId,
	draft,
	viewScale,
	settledScale,
	live,
	stroke,
	outlinedLayer,
	adjusting,
	cuttingOutId,
	regions,
	onImageError,
}: EditorSceneProps) {
	const draftId = draft && !draft.isNew ? draft.layer.id : null;
	const canvas = rect(0, 0, document.width, document.height);
	const contactOffset = useScreenPixels(viewScale, CONTACT_OFFSET_PX);
	const contactBlur = useScreenPixels(viewScale, CONTACT_BLUR_PX);
	const liftOffset = useScreenPixels(viewScale, LIFT_OFFSET_PX);
	const liftBlur = useScreenPixels(viewScale, LIFT_BLUR_PX);
	// Doubled, as the canvas clips away its inner half.
	const edge = useScreenPixels(viewScale, EDGE_PX * 2);
	return (
		<Group>
			<CanvasBackground
				bounds={canvas}
				background={document.background}
				viewScale={settledScale}
			/>
			{document.layers.map((layer) =>
				layer.hidden ? null : (
					<Group
						key={layer.id}
						clip={layer.type === "image" && layer.locked ? canvas : undefined}
					>
						<LiveLayer layer={layer} live={live}>
							{draft && layer.id === draftId ? (
								draft.render(viewScale)
							) : (
								<StrokeTarget
									layer={layer}
									stroke={stroke?.targetId === layer.id ? stroke : null}
									live={live}
									matrix={
										adjusting?.layerId === layer.id
											? adjusting.matrix
											: undefined
									}
									showRemoved={cuttingOutId === layer.id}
									onImageError={onImageError}
								/>
							)}
						</LiveLayer>
					</Group>
				),
			)}
			{draft?.isNew && (
				<Group transform={toTransformList(draft.layer.transform)}>
					{draft.render(viewScale)}
				</Group>
			)}
			{stroke?.targetId === null && (
				<NewLayerStroke
					key={stroke.landedId}
					stroke={stroke}
					viewScale={viewScale}
				/>
			)}
			<Group clip={canvas} invertClip>
				<Fill color={colors.canvasWell} opacity={0.7} />
				{/* One shape each: image filters on one shape chain. */}
				<Rect rect={canvas} color="black">
					<Shadow
						dx={0}
						dy={contactOffset}
						blur={contactBlur}
						color={colors.shadow}
						shadowOnly
					/>
				</Rect>
				<Rect rect={canvas} color="black">
					<Shadow
						dx={0}
						dy={liftOffset}
						blur={liftBlur}
						color={colors.shadow}
						shadowOnly
					/>
				</Rect>
				{showEdge && (
					<Rect
						rect={canvas}
						style="stroke"
						strokeWidth={edge}
						color={colors.hoverOverlay}
					/>
				)}
			</Group>
			{regions.length > 0 && (
				<Group clip={canvas}>
					{regions.map((region) => (
						<RegionOutline
							key={region.sourceIndex}
							region={region}
							viewScale={viewScale}
						/>
					))}
				</Group>
			)}
			<SnapGuides document={document} viewScale={viewScale} live={live} />
			{outlinedLayer && (
				<SelectionOutline layer={outlinedLayer} viewScale={viewScale} />
			)}
			{selectedLayerId !== null && (
				<SelectionHandles live={live} viewScale={viewScale} />
			)}
		</Group>
	);
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
			scaleX: active ? live.scaleX.value : t.scaleX,
			scaleY: active ? live.scaleY.value : t.scaleY,
		});
	}, [layer.id, layer.transform]);

	return <Group transform={transform}>{children}</Group>;
}
