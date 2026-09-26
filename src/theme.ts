import { Platform, type ViewStyle } from "react-native";

// Neutral grays, like a photo editor's surround: a tinted UI would shift how
// the photo's own colors look. The accent carries the warmth.
export const colors = {
	background: "#0A0A0B",
	// Behind the canvas: lighter than the bars around it, so a black canvas
	// and the shadow under it still show.
	canvasWell: "#141416",
	surface: "#151517",
	surfaceHover: "#1D1D20",
	surfacePressed: "#26262A",
	// Laid over whatever is behind a borderless control, so one pair of
	// colors serves every background.
	hoverOverlay: "rgba(255, 255, 255, 0.07)",
	pressedOverlay: "rgba(255, 255, 255, 0.13)",
	border: "#26262A",
	borderStrong: "#3A3A40",
	textPrimary: "#F5F5F7",
	textSecondary: "#8E8E93",
	textTertiary: "#5C5C62",
	accent: "#FF6B4A",
	accentHover: "#FF8263",
	accentPressed: "#E95A3A",
	// Behind something selected, or the accent's glow.
	accentSoft: "rgba(255, 107, 74, 0.14)",
	accentBorder: "rgba(255, 107, 74, 0.5)",
	onAccent: "#1A0D08",
	// The selected layer, on the canvas and in the layers list. Cool, so it
	// stands apart from the accent and from most photos' warm tones.
	selection: "#58A6FF",
	selectionSoft: "rgba(88, 166, 255, 0.16)",
	selectionBorder: "rgba(88, 166, 255, 0.55)",
	// A chosen option among controls (a font, a tool, a swatch's ring): the
	// UI stays neutral, and color is left to the photo and the accent.
	chosen: "#F5F5F7",
	onChosen: "#0A0A0B",
	chosenSoft: "rgba(255, 255, 255, 0.16)",
	// Frosted panels floating over the canvas. Where the platform can't blur
	// behind a view (Android), `glassFallback` stands in, nearly opaque.
	// Dense enough that white text on it still reads over a white photo.
	glass: "rgba(28, 28, 32, 0.72)",
	glassFallback: "rgba(28, 28, 32, 0.96)",
	glassBorder: "rgba(255, 255, 255, 0.09)",
	// A control's fill on glass, lighter than the glass around it.
	glassControl: "rgba(255, 255, 255, 0.06)",
	glassControlHover: "rgba(255, 255, 255, 0.11)",
	danger: "#FF453A",
	dangerHover: "#FF6259",
	dangerPressed: "#E0352B",
	dangerSoft: "rgba(255, 69, 58, 0.16)",
	// Dims the canvas behind modal editing UI.
	scrim: "rgba(0, 0, 0, 0.65)",
	// Lighter still, behind a sheet the canvas stays in view past.
	sheetScrim: "rgba(0, 0, 0, 0.3)",
	// A little lighter, where a blur also quiets what's behind. Dark enough
	// that white text over a white canvas still reads.
	frostedScrim: "rgba(0, 0, 0, 0.6)",
	// The checkerboard that stands for transparency.
	checkerDark: "#2E2E33",
	checkerLight: "#45454B",
};

export const radii = {
	small: 8,
	medium: 12,
	large: 16,
	extraLarge: 22,
	// The floating panels over the canvas.
	panel: 28,
};

// Under anything floating over the canvas.
export const floatingShadow = "0 12px 32px rgba(0, 0, 0, 0.45)";

// The wordmark and screen titles. Until it loads, or if it can't, the system
// font stands in. Controls keep the system font, which suits each platform.
export const fonts = {
	display: "InstrumentSerif-Regular",
	displayItalic: "InstrumentSerif-Italic",
};

// Every bar across the top of a screen, so switching screens and tools never
// shifts the content below.
export const HEADER_HEIGHT = 56;

// A transparency checkerboard square's side, in screen pixels.
export const CHECKER_CELL = 8;

/**
 * Eases hover and press changes on web. Native has no hover, and a press
 * there should answer at once. React Native's style types lack transitions,
 * which only web understands.
 */
export const webTransition =
	Platform.OS === "web"
		? ({
				transitionProperty:
					"background-color, border-color, color, opacity, transform, box-shadow",
				transitionDuration: "160ms",
				transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
			} as unknown as ViewStyle)
		: null;
