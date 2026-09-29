/** A rectangle in an image's pixels, with the origin at its top left. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A line of text, and each of its words. */
export type TextRegion = { line: Rect; words: Rect[] };

/** An image's size, once its EXIF orientation is applied. */
export type Size = { width: number; height: number };

/**
 * A mask of an image's subject, as a grayscale image file: white where the
 * subject is, black where the background is, and gray along soft edges. It
 * covers the whole image, though it may have fewer pixels.
 */
export type SubjectMask = { uri: string; width: number; height: number };

export type Feature = "faces" | "text" | "background";
