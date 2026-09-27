/** A rectangle in an image's pixels, with the origin at its top left. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A line of text, and each of its words. */
export type TextRegion = { line: Rect; words: Rect[] };

export type Feature = "text";
