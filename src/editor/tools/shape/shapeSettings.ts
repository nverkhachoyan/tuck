import { isHexColor } from "../../../ui/color.ts";
import type { Size } from "../../document/geometry.ts";
import {
	type ShapeEdit,
	type ShapeKind,
	type ShapeLayer,
	type ShapeStyle,
	shapeKinds,
} from "../../layers/shape/shape.ts";

export type ShapeSettings = {
	shape: ShapeKind;
	color: string;
	sizeIndex: number;
};

export const defaultShapeSettings: ShapeSettings = {
	shape: "rectangle",
	color: "#FF3B30",
	sizeIndex: 2,
};

export const SHAPE_SIZES = [0.004, 0.008, 0.013, 0.02, 0.03];

const shortSide = (size: Size) => Math.min(size.width, size.height);

/**
 * Parses saved shape preferences.
 * - Restores geometric kind, color, and stroke size index.
 * - Falls back to defaultShapeSettings when values are invalid or absent.
 */
export function parseShapeSettings(saved: unknown): ShapeSettings {
	if (typeof saved !== "object" || saved === null) return defaultShapeSettings;
	const { shape, color, sizeIndex, sizes } = saved as Record<string, unknown>;
	const savedSizes = (
		typeof sizes === "object" && sizes !== null ? sizes : {}
	) as Record<string, unknown>;
	const parsedSize =
		typeof sizeIndex === "number" &&
		Number.isInteger(sizeIndex) &&
		sizeIndex >= 0 &&
		sizeIndex < SHAPE_SIZES.length
			? sizeIndex
			: typeof savedSizes.shape === "number" &&
					Number.isInteger(savedSizes.shape) &&
					savedSizes.shape >= 0 &&
					savedSizes.shape < SHAPE_SIZES.length
				? savedSizes.shape
				: defaultShapeSettings.sizeIndex;
	return {
		shape:
			shapeKinds.find((kind) => kind === shape) ?? defaultShapeSettings.shape,
		color: isHexColor(color) ? color : defaultShapeSettings.color,
		sizeIndex: parsedSize,
	};
}

export function shapeStyleFor(settings: ShapeSettings, size: Size): ShapeStyle {
	return {
		color: settings.color,
		strokeWidth: SHAPE_SIZES[settings.sizeIndex] * shortSide(size),
	};
}

export function stepShapeSize(
	settings: ShapeSettings,
	step: 1 | -1,
): ShapeSettings {
	const next = Math.min(
		SHAPE_SIZES.length - 1,
		Math.max(0, settings.sizeIndex + step),
	);
	if (next === settings.sizeIndex) return settings;
	return { ...settings, sizeIndex: next };
}

export function withSelectedShape(
	settings: ShapeSettings,
	layer: ShapeLayer,
	size: Size,
): ShapeSettings {
	const share = (layer.strokeWidth * layer.transform.scaleX) / shortSide(size);
	let index = 0;
	SHAPE_SIZES.forEach((width, candidate) => {
		if (Math.abs(width - share) < Math.abs(SHAPE_SIZES[index] - share)) {
			index = candidate;
		}
	});
	return {
		...settings,
		shape: layer.shape,
		color: layer.color,
		sizeIndex: index,
	};
}

export function shapePatch(
	before: ShapeSettings,
	after: ShapeSettings,
	size: Size,
	layerScale: number,
): ShapeEdit {
	const edit: ShapeEdit = {};
	if (after.shape !== before.shape) edit.shape = after.shape;
	if (after.color !== before.color) edit.color = after.color;
	if (after.sizeIndex !== before.sizeIndex) {
		edit.strokeWidth = shapeStyleFor(after, size).strokeWidth / layerScale;
	}
	return edit;
}
