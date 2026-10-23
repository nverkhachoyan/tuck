// React Native Skia's web build reads React Native's asset registry only for
// a `require`d image or font, which the docs never use.
export function getAssetByID(): never {
	throw new Error("The docs have no React Native asset registry.");
}
