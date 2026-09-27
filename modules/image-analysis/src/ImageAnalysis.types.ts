/** A rectangle in an image's pixels, with the origin at its top left. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A line of text, and each of its words. */
export type TextRegion = { line: Rect; words: Rect[] };

/** An image's size, once its EXIF orientation is applied. */
export type Size = { width: number; height: number };

export type Feature = "faces" | "text";
