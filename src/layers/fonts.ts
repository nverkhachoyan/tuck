import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { Skia, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { use } from "react";

/**
 * The one typeface text layers use, bundled rather than taken from the
 * system: system fonts differ per platform (and CanvasKit on web has none),
 * so a bundled font is what makes a document export the same everywhere.
 * Anton is a condensed, Impact-style face under the SIL Open Font License.
 */
export const TEXT_FONT_FAMILY = "Anton";

let fontProvider: SkTypefaceFontProvider | null = null;
let fontsPromise: Promise<void> | null = null;

/**
 * Registers the text font with Skia (canvas and export) and with React
 * Native (the text editor's input). Safe to call repeatedly.
 */
export function loadFonts(): Promise<void> {
	fontsPromise ??= Promise.all([
		loadSkiaFont(),
		Font.loadAsync({ [TEXT_FONT_FAMILY]: Anton_400Regular }),
	]).then(() => undefined);
	return fontsPromise;
}

async function loadSkiaFont() {
	const asset = Asset.fromModule(Anton_400Regular);
	await asset.downloadAsync();
	const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
	const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
	if (!typeface) {
		throw new Error(`Could not load the ${TEXT_FONT_FAMILY} font`);
	}
	const provider = Skia.TypefaceFontProvider.Make();
	provider.registerFont(typeface, TEXT_FONT_FAMILY);
	fontProvider = provider;
}

/** The Skia font provider for text paragraphs; requires `LoadFonts` above. */
export function getFontProvider(): SkTypefaceFontProvider {
	if (!fontProvider) {
		throw new Error("Text laid out before fonts loaded; mount <LoadFonts />");
	}
	return fontProvider;
}

/**
 * Suspends until the fonts are ready. Text layout runs synchronously (during
 * rendering and hit-testing), so the font must exist before any editor UI
 * mounts. Mount it inside the same Suspense boundary as the app.
 */
export function LoadFonts() {
	// Expo renders routes in Node when exporting a static site; there's no
	// text to lay out there, and no Skia to load fonts into.
	if (typeof window === "undefined") return null;

	use(loadFonts());
	return null;
}
