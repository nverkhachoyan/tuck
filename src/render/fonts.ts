import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { CourierPrime_700Bold } from "@expo-google-fonts/courier-prime/700Bold";
import { Montserrat_800ExtraBold } from "@expo-google-fonts/montserrat/800ExtraBold";
import { PermanentMarker_400Regular } from "@expo-google-fonts/permanent-marker/400Regular";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { Skia, type SkTypefaceFontProvider } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { use } from "react";
import type { TextFont } from "@/model/document";

/**
 * The typefaces text layers use, each in the one weight it's drawn in. They
 * are bundled rather than taken from the system: system fonts differ per
 * platform (and CanvasKit on web has none), so bundled fonts are what make a
 * document export the same everywhere. All are under the SIL Open Font
 * License, except Permanent Marker (Apache 2.0).
 *
 * `family` is the name each is registered under, with both Skia (canvas and
 * export) and React Native (the text editor's input and the font picker).
 */
export const TEXT_FONTS: Record<TextFont, { family: string; source: number }> =
	{
		classic: { family: "Anton", source: Anton_400Regular },
		modern: { family: "Montserrat-ExtraBold", source: Montserrat_800ExtraBold },
		serif: { family: "PlayfairDisplay-Bold", source: PlayfairDisplay_700Bold },
		marker: { family: "PermanentMarker", source: PermanentMarker_400Regular },
		typewriter: { family: "CourierPrime-Bold", source: CourierPrime_700Bold },
	};

let fontProvider: SkTypefaceFontProvider | null = null;
let fontsPromise: Promise<void> | null = null;
let fontsFailed = false;

/** Registers the text fonts with Skia and React Native. Safe to call repeatedly. */
export function loadFonts(): Promise<void> {
	const fonts = Object.values(TEXT_FONTS);
	fontsPromise ??= Promise.all([
		loadSkiaFonts(),
		Font.loadAsync(
			Object.fromEntries(fonts.map(({ family, source }) => [family, source])),
		),
	])
		.then(() => undefined)
		.catch((error: unknown) => {
			fontsFailed = true;
			throw error;
		});
	return fontsPromise;
}

/**
 * Lets the next `loadFonts` try again after one failed. Until then it keeps
 * returning the failed promise: `use` must see that reject to reach an error
 * boundary, rather than suspend on a fresh attempt, forever if the failure
 * persists.
 */
export function resetFailedFonts() {
	if (!fontsFailed) return;
	fontsFailed = false;
	fontsPromise = null;
}

async function loadSkiaFonts() {
	const provider = Skia.TypefaceFontProvider.Make();
	await Promise.all(
		Object.values(TEXT_FONTS).map(async ({ family, source }) => {
			const asset = Asset.fromModule(source);
			await asset.downloadAsync();
			const data = await Skia.Data.fromURI(asset.localUri ?? asset.uri);
			const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
			if (!typeface) {
				throw new Error(`Could not load the ${family} font`);
			}
			provider.registerFont(typeface, family);
		}),
	);
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
 * rendering and hit-testing), so the fonts must exist before any editor UI
 * mounts. Mount it inside the same Suspense boundary as the app.
 */
export function LoadFonts() {
	// Expo renders routes in Node when exporting a static site; there's no
	// text to lay out there, and no Skia to load fonts into.
	if (typeof window === "undefined") return null;

	use(loadFonts());
	return null;
}
