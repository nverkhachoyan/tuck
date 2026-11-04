/**
 * Image layers' photos decoded for drawing offscreen (`drawOffscreen`). Here
 * that's the same cache the editor draws from, so export reuses a photo the
 * canvas already holds; web decodes them outside CanvasKit's heap
 * (`offscreenPhotos.web.ts`).
 */
export { decodedImages as offscreenPhotos } from "./decodedImages";
