// `serviceWorker.web.ts` lets the web app open offline. Native apps are
// installed already, so these do nothing.

export function registerServiceWorker() {}

/** On web, applies a downloaded version of the app; never on native. */
export function useUpdateReady(): (() => void) | null {
	return null;
}
