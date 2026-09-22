// Expo's runtime first: among other things it installs the loader Metro's
// dynamic `import()` below needs on web.
import "expo";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

// On web, Skia's module binds to CanvasKit (its WASM build) the moment it's
// first evaluated, and Expo Router evaluates every route at startup. So the
// app's code may only load once CanvasKit has: nothing may import Skia above
// this line, and the router is imported dynamically.
LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(
	// @ts-expect-error: untyped, and imported only for its side effect.
	() => import("expo-router/entry"),
);
