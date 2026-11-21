import { type ComponentType, Suspense, use } from "react";
import { Platform } from "react-native";
import { loadSkia, onResetFailedSkia } from "./skia";

// Expo renders routes in Node when exporting a static site; there's no
// CanvasKit there, so routes that need Skia render their fallback instead.
const prerendering = Platform.OS === "web" && typeof window === "undefined";

/**
 * Loads a route's screen only once Skia (CanvasKit on web) is ready. Its
 * import must be dynamic so the bundler doesn't evaluate Skia with the page.
 * A failed load stays rejected for the error boundary until `resetFailedSkia`
 * lets the next render try again.
 */
export function withSkia(
	load: () => Promise<{ default: ComponentType }>,
	Fallback?: ComponentType,
): ComponentType {
	let loaded: ComponentType | null = null;
	let promise: Promise<ComponentType> | null = null;
	let failed = false;

	onResetFailedSkia(() => {
		if (!failed) return;
		failed = false;
		promise = null;
	});

	function getScreen(): Promise<ComponentType> {
		promise ??= loadSkia()
			.then(load)
			.then((module) => {
				loaded = module.default;
				return module.default;
			})
			.catch((error: unknown) => {
				failed = true;
				throw error;
			});
		return promise;
	}

	function LoadedScreen() {
		const Screen = loaded ?? use(getScreen());
		return <Screen />;
	}

	return function SkiaRoute() {
		if (prerendering) return Fallback ? <Fallback /> : null;
		if (loaded) {
			const Screen = loaded;
			return <Screen />;
		}
		return (
			<Suspense fallback={Fallback ? <Fallback /> : null}>
				<LoadedScreen />
			</Suspense>
		);
	};
}
