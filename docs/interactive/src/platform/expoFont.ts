// What `editor/layers/text/fonts.ts` uses of `expo-font`: registering each font with the
// page, as Expo does on web, so DOM text can use it too.
export async function loadAsync(fonts: Record<string, string>): Promise<void> {
	await Promise.all(
		Object.entries(fonts).map(async ([family, url]) => {
			const face = await new FontFace(family, `url(${url})`).load();
			document.fonts.add(face);
		}),
	);
}
