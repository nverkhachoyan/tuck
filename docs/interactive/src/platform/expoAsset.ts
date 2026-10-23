// What `render/fonts.ts` uses of `expo-asset`. A font's module is already its
// URL here (see the `expo-google-fonts` plugin in `vite.config.ts`).
export const Asset = {
	fromModule(source: string) {
		return {
			uri: source,
			localUri: null,
			downloadAsync: async () => {},
		};
	},
};
