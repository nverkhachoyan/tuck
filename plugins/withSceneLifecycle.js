const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

// Apps built with the iOS 27 SDK must adopt the scene-based life cycle, or
// UIKit stops them at launch. Expo 57 has the scene delegate, but its template
// still starts React Native from the app delegate, so this applies the changes
// the SDK 58 template makes. Remove it once `ios/` comes from a template that
// already has them.

const PROVIDER = "ExpoReactNativeFactoryProvider";
const CLASS_LINE = "class AppDelegate: ExpoAppDelegate {";
// The template creates the window and starts React Native here; the scene
// delegate does both once a scene connects.
const WINDOW_SETUP =
	/\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

function withSceneAppDelegate(config) {
	return withAppDelegate(config, (config) => {
		const { contents } = config.modResults;
		if (contents.includes(PROVIDER)) {
			return config;
		}
		if (!contents.includes(CLASS_LINE) || !WINDOW_SETUP.test(contents)) {
			throw new Error(
				"withSceneLifecycle couldn't find the template's AppDelegate code. Compare AppDelegate.swift with the template and update plugins/withSceneLifecycle.js.",
			);
		}
		config.modResults.contents = contents
			.replace(CLASS_LINE, `class AppDelegate: ExpoAppDelegate, ${PROVIDER} {`)
			.replace(WINDOW_SETUP, "");
		return config;
	});
}

// Names Expo's delegate by its Objective-C name, so the project needs no
// Swift subclass of its own.
function withSceneManifest(config) {
	return withInfoPlist(config, (config) => {
		config.modResults.UIApplicationSceneManifest = {
			UIApplicationSupportsMultipleScenes: false,
			UISceneConfigurations: {
				UIWindowSceneSessionRoleApplication: [
					{
						UISceneConfigurationName: "Default Configuration",
						UISceneDelegateClassName: "EXExpoAppSceneDelegate",
					},
				],
			},
		};
		return config;
	});
}

module.exports = (config) => withSceneManifest(withSceneAppDelegate(config));
