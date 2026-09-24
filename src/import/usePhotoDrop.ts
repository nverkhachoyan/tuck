/**
 * Hands over images pasted or dropped onto the page while `enabled`, as a
 * URI that's only good until the promise `onPhoto` returns settles. Only web
 * has a page to drop onto; see `usePhotoDrop.web.ts`. `dragging` is whether
 * files are being dragged over the page now.
 */
export function usePhotoDrop(_options: {
	enabled: boolean;
	onPhoto: (uri: string) => Promise<void>;
}): { dragging: boolean } {
	return { dragging: false };
}
