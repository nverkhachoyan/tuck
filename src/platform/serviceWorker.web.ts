import { useSyncExternalStore } from "react";

// The browser's counterpart to `serviceWorker.ts`. `sw.js` is written by
// `scripts/write-service-worker.mjs` in a production export, so the dev
// server has none.

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function setWaiting(worker: ServiceWorker) {
	waiting = worker;
	for (const listener of listeners) listener();
}

/**
 * Installs the service worker once the page has loaded, so it doesn't
 * compete with the app for the connection. A new version installs behind
 * the running one and waits; `useUpdateReady` offers to switch.
 */
export function registerServiceWorker() {
	if (
		process.env.NODE_ENV !== "production" ||
		!("serviceWorker" in navigator)
	) {
		return;
	}
	const register = async () => {
		const registration = await navigator.serviceWorker.register("/sw.js");
		// The first install has nothing to replace.
		const offer = (worker: ServiceWorker | null) => {
			if (!worker || !navigator.serviceWorker.controller) return;
			if (worker.state === "installed") setWaiting(worker);
			worker.addEventListener("statechange", () => {
				if (worker.state === "installed") setWaiting(worker);
			});
		};
		offer(registration.waiting ?? registration.installing);
		registration.addEventListener("updatefound", () =>
			offer(registration.installing),
		);
		// A tab can stay open for days without navigating, which is when
		// browsers look for a new version themselves.
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				registration.update().catch(() => {});
			}
		});
	};
	const start = () => {
		register().catch(() => {
			// Working offline is a bonus; the app runs without it.
		});
	};
	if (document.readyState === "complete") start();
	else window.addEventListener("load", start, { once: true });
}

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * When a new version of the app has downloaded, a function that reloads into
 * it; otherwise null.
 */
export function useUpdateReady(): (() => void) | null {
	const worker = useSyncExternalStore(
		subscribe,
		() => waiting,
		() => null,
	);
	if (!worker) return null;
	return () => {
		navigator.serviceWorker.addEventListener(
			"controllerchange",
			() => window.location.reload(),
			{ once: true },
		);
		worker.postMessage("skipWaiting");
	};
}
