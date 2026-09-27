const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

// The ML Kit models Play services should download when the app is installed,
// rather than the first time they're used.
const MODELS = ["ocr"];
const DEPENDENCIES = "com.google.mlkit.vision.DEPENDENCIES";

// Other libraries set this too (the dev launcher asks for `barcode_ui`), and
// the manifest merger can't combine their values, so the app's own manifest
// replaces them.
function withMlKitDependencies(config) {
	return withAndroidManifest(config, (config) => {
		const manifest = config.modResults;
		manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
		const application =
			AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
		AndroidConfig.Manifest.addMetaDataItemToMainApplication(
			application,
			DEPENDENCIES,
			MODELS.join(","),
		);
		const item = application["meta-data"].find(
			(entry) => entry.$["android:name"] === DEPENDENCIES,
		);
		item.$["tools:replace"] = "android:value";
		return config;
	});
}

module.exports = withMlKitDependencies;
