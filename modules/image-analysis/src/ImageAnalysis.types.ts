/** A rectangle in an image's pixels, with the origin at its top left. */
export type Rect = { x: number; y: number; width: number; height: number };

export type TextRegion = { line: Rect; words: Rect[] };

/**
 * A point in an image, as fractions of its width and height once its EXIF
 * orientation is applied: (0, 0) is its top left, and (1, 1) its bottom right.
 */
export type ImagePoint = { x: number; y: number };

/** An image's size, once its EXIF orientation is applied. */
export type Size = { width: number; height: number };

/**
 * A mask of an image's subject, as a grayscale image file: white where the
 * subject is, black where the background is, and gray along soft edges. It
 * covers the whole image, though it may have fewer pixels.
 */
export type SubjectMask = { uri: string; width: number; height: number };

/**
 * Masks of what's at a point, from a part of it to the whole, smallest
 * first, and the index of the one the model thinks likeliest meant.
 */
export type ObjectMasks = { masks: SubjectMask[]; likeliest: number };

export type Feature = "faces" | "text" | "background";
