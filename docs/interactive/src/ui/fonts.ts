import antonUrl from "@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf";

/**
 * Anton, the typeface of Tuck's wordmark and its "classic" captions, loaded
 * from the same package the app bundles. Resolves once it can be measured.
 */
export const antonLoaded: Promise<void> = new FontFace(
	"Anton",
	`url(${antonUrl})`,
)
	.load()
	.then((font) => {
		document.fonts.add(font);
	})
	.catch(() => {});
