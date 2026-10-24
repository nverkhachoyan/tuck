import {
	Appearance,
	Platform,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import { readPreference } from "@/platform/preferenceStore";
import { compactControls } from "./density";

/** The palette chosen in Settings: the system's, or always one of them. */
export type ThemeSetting = "system" | "light" | "dark";

// Also read by `+html.tsx`'s script, as `tuck:theme` in localStorage.
export const THEME_PREFERENCE = "theme";

export function parseThemeSetting(saved: unknown): ThemeSetting {
	return saved === "light" || saved === "dark" ? saved : "system";
}

export const themeSetting = parseThemeSetting(readPreference(THEME_PREFERENCE));

/**
 * The palette is picked when the app starts, from Settings or the system's
 * setting, and kept until the next launch: every style reads `colors` once,
 * as it's created, so changing the setting reloads the app. Native controls
 * (the keyboard, alerts, the status bar) are pinned to the same scheme so
 * they match.
 */
export const colorScheme: "light" | "dark" =
	themeSetting !== "system"
		? themeSetting
		: Appearance.getColorScheme() === "dark"
			? "dark"
			: "light";
if (Platform.OS !== "web") Appearance.setColorScheme(colorScheme);

// The photo is a print on a light table: a pale gray surround, paper bars,
// and black ink. Grays stay neutral so the photo's colors read true. The one
// color of the app's own is the highlighter behind a chosen thing.
const day = {
	// The bars, the dock, and every screen.
	background: "#FFFFFF",
	// The table behind the canvas.
	canvasWell: "#E2E3E6",
	// Trays, sheets, and cards floating over the canvas.
	surface: "#FFFFFF",
	surfaceHover: "#F2F3F5",
	surfacePressed: "#E7E8EB",
	// Laid over whatever is behind a borderless control, so one pair of
	// colors serves every background.
	hoverOverlay: "rgba(0, 0, 0, 0.05)",
	pressedOverlay: "rgba(0, 0, 0, 0.1)",
	border: "#E1E2E6",
	borderStrong: "#C8CACF",
	textPrimary: "#000000",
	textSecondary: "#5D5F66",
	// Disabled controls and decoration only: too faint for text people need
	// to read.
	textTertiary: "#9A9CA3",
	// The main action's fill: a solid bar of ink.
	primary: "#000000",
	primaryHover: "#26272B",
	primaryPressed: "#3A3B40",
	onPrimary: "#FFFFFF",
	// The highlighter swiped behind a chosen thing, and the wordmark's.
	highlight: "#FFE433",
	onHighlight: "#000000",
	// Behind a drop target or a confirmation.
	highlightSoft: "rgba(255, 228, 51, 0.28)",
	highlightBorder: "#E8C800",
	// The selected layer, and anything else drawn over the photo (snap
	// guides, detection's picks): cool, so it stands apart from most photos'
	// warm tones.
	selection: "#2F6BFF",
	selectionSoft: "rgba(47, 107, 255, 0.16)",
	selectionBorder: "rgba(47, 107, 255, 0.55)",
	onSelection: "#FFFFFF",
	// A chosen color's ring (`RingChoice`). Other choices are highlighted
	// (`ui/Highlight.tsx`).
	chosen: "#000000",
	// Around every color swatch, so white shows on the paper and black on a
	// dark photo.
	swatchRing: "rgba(0, 0, 0, 0.2)",
	danger: "#D92D20",
	dangerHover: "#C2261A",
	dangerPressed: "#A82016",
	dangerSoft: "rgba(217, 45, 32, 0.1)",
	// Dims the canvas behind modal editing UI.
	scrim: "rgba(0, 0, 0, 0.45)",
	// Lighter still, behind a sheet the canvas stays in view past.
	sheetScrim: "rgba(0, 0, 0, 0.22)",
	// The checkerboard that stands for transparency.
	checkerDark: "#D3D5D9",
	checkerLight: "#EDEEF0",
	// Under anything floating over the canvas.
	shadow: "rgba(0, 0, 0, 0.16)",
};

// The same system after dark, on a graphite table: lighter than black, so
// the photo still sits on something.
const night: typeof day = {
	background: "#17181B",
	canvasWell: "#2B2C30",
	surface: "#202125",
	surfaceHover: "#2A2B30",
	surfacePressed: "#34353A",
	hoverOverlay: "rgba(255, 255, 255, 0.07)",
	pressedOverlay: "rgba(255, 255, 255, 0.13)",
	border: "#2E3035",
	borderStrong: "#45474D",
	textPrimary: "#F3F3F1",
	textSecondary: "#9A9CA3",
	textTertiary: "#64666D",
	primary: "#F3F3F1",
	primaryHover: "#FFFFFF",
	primaryPressed: "#D9D9D7",
	onPrimary: "#000000",
	highlight: "#FFE433",
	onHighlight: "#000000",
	highlightSoft: "rgba(255, 228, 51, 0.16)",
	highlightBorder: "rgba(255, 228, 51, 0.6)",
	selection: "#5B8CFF",
	selectionSoft: "rgba(91, 140, 255, 0.18)",
	selectionBorder: "rgba(91, 140, 255, 0.6)",
	onSelection: "#FFFFFF",
	chosen: "#F3F3F1",
	swatchRing: "rgba(255, 255, 255, 0.3)",
	danger: "#FF5A4F",
	dangerHover: "#FF766D",
	dangerPressed: "#E6463B",
	dangerSoft: "rgba(255, 90, 79, 0.16)",
	scrim: "rgba(0, 0, 0, 0.65)",
	sheetScrim: "rgba(0, 0, 0, 0.35)",
	checkerDark: "#36373C",
	checkerLight: "#48494F",
	shadow: "rgba(0, 0, 0, 0.5)",
};

export const colors = colorScheme === "dark" ? night : day;

export const radii = {
	// Controls and chips.
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
export const floatingShadow = `0 10px 28px ${colors.shadow}`;
// Under panels resting on the table beside the canvas (the wide editor's
// rail and inspector): fainter, so the photo stays the thing that stands out.
export const restingShadow =
	colorScheme === "dark"
		? "0 8px 24px rgba(0, 0, 0, 0.35)"
		: "0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.06)";

// The wordmark and home's headings, in Anton, the typeface of the captions
// people make (`TEXT_FONTS.classic`, registered under this name). Until it
// loads, the system font stands in. Controls keep the system font, which
// suits each platform.
export const fonts = {
	display: "Anton",
};

// Every bar across the top of a screen, so switching screens and tools never
// shifts the content below. Shorter where controls are sized for a mouse.
export const HEADER_HEIGHT = compactControls ? 48 : 56;

// A transparency checkerboard square's side, in screen pixels.
export const CHECKER_CELL = 8;

/**
 * Eases hover and press changes on web. Native has no hover, and a press
 * there should answer at once. It's short and starts at full speed, so a
 * hover or press shows on its first frame. React Native's style types lack
 * transitions, which only web understands.
 */
export const webTransition =
	Platform.OS === "web"
		? ({
				transitionProperty:
					"background-color, border-color, color, opacity, transform, box-shadow",
				transitionDuration: "100ms",
				transitionTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
			} as unknown as ViewStyle)
		: null;
