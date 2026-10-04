import { Platform, type TextStyle, type ViewStyle } from "react-native";

// Neutral grays, like a photo editor's surround: a tinted UI would shift how
// the photo's own colors look. The accent carries the warmth.
export const colors = {
	background: "#0A0A0B",
	// Behind the canvas: the screen's own color, so the photo sits on the
	// same surface as the bars around it. The canvas's hairline edge keeps a
	// black one visible.
	canvasWell: "#0A0A0B",
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
	// A chosen option's outline, ring, or underline (see `chosenOutline`): the
	// UI stays neutral, and color is left to the photo and the accent.
	chosen: "#F5F5F7",
	// Around every color swatch, so black shows on the dark UI and white on a
	// light photo.
	swatchRing: "rgba(255, 255, 255, 0.3)",
	danger: "#FF453A",
	dangerHover: "#FF6259",
	dangerPressed: "#E0352B",
	dangerSoft: "rgba(255, 69, 58, 0.16)",
	// Dims the canvas behind modal editing UI.
	scrim: "rgba(0, 0, 0, 0.65)",
	// Lighter still, behind a sheet the canvas stays in view past.
	sheetScrim: "rgba(0, 0, 0, 0.3)",
	// The checkerboard that stands for transparency.
	checkerDark: "#2E2E33",
	checkerLight: "#45454B",
};

export const radii = {
	// Controls, chips, and a chosen option's outline.
	small: 8,
	// Buttons, cards, and the selection bar.
	medium: 12,
	// Sheets, dialogs, and cards floating over the canvas.
	large: 20,
};

// Gaps and paddings come from these; a one-off that fits no step stays
// literal.
export const space = {
	xxs: 4,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 24,
	xl: 32,
};

// The text sizes and weights for controls, in the system font.
export const typography = {
	// Tool labels, hints, and small print.
	caption: { fontSize: 12, fontWeight: "500" },
	// Chips, tabs, rows, and small buttons.
	label: { fontSize: 13, fontWeight: "400" },
	labelStrong: { fontSize: 13, fontWeight: "600" },
	// Running text in cards, sheets, and dialogs.
	body: { fontSize: 15, fontWeight: "400" },
	bodyStrong: { fontSize: 15, fontWeight: "600" },
	// Buttons, and screen and mode titles.
	title: { fontSize: 17, fontWeight: "600" },
	// A value read at a glance while it changes, like an adjustment's.
	figure: { fontSize: 28, fontWeight: "600", fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

// Under anything floating over the canvas.
export const floatingShadow = "0 12px 32px rgba(0, 0, 0, 0.45)";

// The wordmark and screen titles. Until it loads, or if it can't, the system
// font stands in. Controls keep the system font, which suits each platform.
export const fonts = {
	display: "InstrumentSerif-Regular",
	displayItalic: "InstrumentSerif-Italic",
};

// A chosen option among controls (a tool, a font, an aspect ratio): a thin
// outline with `radii.small` corners, never a fill. Fill is left for what
// really is a color.
export const chosenOutline: ViewStyle = {
	boxShadow: `inset 0 0 0 1.5px ${colors.chosen}`,
};

// The chosen tab: an underline along its label's bottom edge.
export const chosenUnderline: ViewStyle = {
	boxShadow: `inset 0 -2px 0 ${colors.chosen}`,
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
