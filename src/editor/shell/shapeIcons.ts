import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { ShapeKind } from "../layers/shape/shape";

// Each shape's name and icon, as the draw tool and the layers panel show it.

export const SHAPE_NAMES: Record<ShapeKind, string> = {
	rectangle: "Rectangle",
	ellipse: "Ellipse",
	line: "Line",
	arrow: "Arrow",
};

export const SHAPE_ICONS: Record<
	ShapeKind,
	ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
	rectangle: "rectangle-outline",
	ellipse: "ellipse-outline",
	line: "vector-line",
	arrow: "arrow-top-right",
};
