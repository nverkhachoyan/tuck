/** An image ready for the editor to draw. */
export type PickedImage = {
	uri: string;
	width: number;
	height: number;
	// A JPEG if every pixel is opaque, else a PNG, which keeps transparency.
	opaque: boolean;
};

export type PickedImageResult =
	| { status: "picked"; photo: PickedImage }
	| { status: "canceled" };

export type ImageSizeLimits = {
	// Shrinks the image so its shorter side is at most this many pixels.
	maxShortSide?: number;
	// And so its longer side is at most this many.
	maxLongSide?: number;
};

/**
 * What the app hands the editor: its own concepts, which the editor knows
 * only through this.
 * - `pickPhoto`: lets the user pick a photo, read so the editor can draw it.
 * - `importPhoto`: makes an image at a URI (a dropped file's, on web) ready
 *   the same way.
 * - `addImage`: keeps an image the document gains, giving the URI the
 *   document should use.
 * - `title`: what the app calls the document.
 * - `saveProblem`: why edits aren't being kept, if they aren't, with
 *   `retrySave` when trying again might help.
 * - `focused`: whether the editor is in front, rather than behind another
 *   screen.
 * - `leave`, `openExport`: called once any text being typed is finished.
 */
export type EditorHost = {
	pickPhoto: (limits: ImageSizeLimits) => Promise<PickedImageResult>;
	importPhoto: (uri: string, limits: ImageSizeLimits) => Promise<PickedImage>;
	addImage: (uri: string, opaque: boolean) => Promise<string>;
	title: string;
	saveProblem: string | null;
	retrySave?: () => void;
	focused: boolean;
	leave: () => void;
	openExport: () => void;
};
