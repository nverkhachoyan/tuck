import { type NativeIntent, router } from "expo-router";
import { sharedPhotoName } from "@/import/sharedPhoto";

/**
 * Sends a photo shared from another app to the home screen, which opens it
 * once it's ended any editing session. Other links pass through.
 */
export const redirectSystemPath: NonNullable<
	NativeIntent["redirectSystemPath"]
> = ({ path, initial }) => {
	const shared = sharedPhotoName(path);
	if (shared === null) return path;
	if (initial) return `/?shared=${encodeURIComponent(shared)}`;
	// Following a link pushes its screen, even one already open: this goes
	// back to home instead, from the editor or anything else on top.
	router.dismissTo({ pathname: "/", params: { shared } });
	return null;
};
