const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist").default;
const {
	AndroidConfig,
	withAndroidManifest,
	withEntitlementsPlist,
	withXcodeProject,
} = require("expo/config-plugins");

// Lists Tuck in other apps' share sheets for a single image, as "Edit in
// Tuck". iOS takes it in a share extension, a target of its own, and Android
// in `ShareActivity`. Both copy the photo where the app can read it and open
// <scheme>://share?file=<name>, which src/photos/sharedPhoto.ts reads.

const TARGET = "ShareExtension";
const SWIFT_FILE = "ShareViewController.swift";
const INFO_FILE = "Info.plist";
const ENTITLEMENTS_FILE = `${TARGET}.entitlements`;

const label = (config) => `Edit in ${config.name}`;
const appGroup = (config) => `group.${config.ios.bundleIdentifier}`;
const extensionBundleId = (config) =>
	`${config.ios.bundleIdentifier}.${TARGET}`;

// The extension and the app share this group's folder.
function withAppGroup(config) {
	return withEntitlementsPlist(config, (config) => {
		const key = "com.apple.security.application-groups";
		const groups = config.modResults[key] ?? [];
		if (!groups.includes(appGroup(config))) {
			config.modResults[key] = [...groups, appGroup(config)];
		}
		return config;
	});
}

// EAS Build signs only the targets it's told about, so it makes the
// extension's provisioning profile, App Group included, from this entry.
function withEasAppExtension(config) {
	const eas = config.extra?.eas ?? {};
	const experimental = eas.build?.experimental ?? {};
	const others = (experimental.ios?.appExtensions ?? []).filter(
		(extension) => extension.targetName !== TARGET,
	);
	const extension = {
		targetName: TARGET,
		bundleIdentifier: extensionBundleId(config),
		entitlements: {
			"com.apple.security.application-groups": [appGroup(config)],
		},
	};
	return {
		...config,
		extra: {
			...config.extra,
			eas: {
				...eas,
				build: {
					...eas.build,
					experimental: {
						...experimental,
						ios: { ...experimental.ios, appExtensions: [...others, extension] },
					},
				},
			},
		},
	};
}

function writeExtensionFiles(config, folder) {
	fs.mkdirSync(folder, { recursive: true });
	fs.copyFileSync(
		path.join(__dirname, TARGET, SWIFT_FILE),
		path.join(folder, SWIFT_FILE),
	);
	fs.writeFileSync(
		path.join(folder, INFO_FILE),
		plist.build({
			CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
			CFBundleDisplayName: label(config),
			CFBundleExecutable: "$(EXECUTABLE_NAME)",
			CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
			CFBundleInfoDictionaryVersion: "6.0",
			CFBundleName: "$(PRODUCT_NAME)",
			CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
			// An extension's version must match its app's.
			CFBundleShortVersionString: config.version ?? "1.0.0",
			CFBundleVersion: config.ios.buildNumber ?? "1",
			NSExtension: {
				NSExtensionAttributes: {
					NSExtensionActivationRule: {
						NSExtensionActivationSupportsImageWithMaxCount: 1,
					},
				},
				NSExtensionPointIdentifier: "com.apple.share-services",
				NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).ShareViewController",
			},
			HostAppGroup: appGroup(config),
			HostAppScheme: config.scheme,
		}),
	);
	fs.writeFileSync(
		path.join(folder, ENTITLEMENTS_FILE),
		plist.build({
			"com.apple.security.application-groups": [appGroup(config)],
		}),
	);
}

function withShareExtension(config) {
	return withXcodeProject(config, (config) => {
		const project = config.modResults;
		const folder = path.join(config.modRequest.platformProjectRoot, TARGET);
		writeExtensionFiles(config, folder);
		if (project.pbxTargetByName(TARGET)) return config;

		// The app's own settings, which the extension's must match.
		const [, app] = findAppTarget(project);
		const appSettings = buildSettingsOf(project, app);

		const group = project.addPbxGroup(
			[SWIFT_FILE, INFO_FILE, ENTITLEMENTS_FILE],
			TARGET,
			TARGET,
		);
		const mainGroup = project.getFirstProject().firstProject.mainGroup;
		project.addToPbxGroup(group.uuid, mainGroup);

		// `addTarget` expects these sections, which a project with a single
		// target doesn't have yet.
		const objects = project.hash.project.objects;
		objects.PBXTargetDependency ??= {};
		objects.PBXContainerItemProxy ??= {};

		const target = project.addTarget(
			TARGET,
			"app_extension",
			TARGET,
			extensionBundleId(config),
		);
		project.addBuildPhase(
			[SWIFT_FILE],
			"PBXSourcesBuildPhase",
			"Sources",
			target.uuid,
		);
		project.addBuildPhase(
			[],
			"PBXResourcesBuildPhase",
			"Resources",
			target.uuid,
		);
		project.addBuildPhase(
			[],
			"PBXFrameworksBuildPhase",
			"Frameworks",
			target.uuid,
		);
		// `addTarget` names the product without its extension.
		const product =
			objects.PBXFileReference[target.pbxNativeTarget.productReference];
		product.path = `"${TARGET}.appex"`;

		const settings = {
			APPLICATION_EXTENSION_API_ONLY: "YES",
			CLANG_ENABLE_MODULES: "YES",
			CODE_SIGN_ENTITLEMENTS: `${TARGET}/${ENTITLEMENTS_FILE}`,
			CODE_SIGN_STYLE: "Automatic",
			INFOPLIST_FILE: `${TARGET}/${INFO_FILE}`,
			IPHONEOS_DEPLOYMENT_TARGET: appSettings.IPHONEOS_DEPLOYMENT_TARGET,
			SWIFT_VERSION: "5.0",
			TARGETED_DEVICE_FAMILY: appSettings.TARGETED_DEVICE_FAMILY,
		};
		if (appSettings.DEVELOPMENT_TEAM) {
			settings.DEVELOPMENT_TEAM = appSettings.DEVELOPMENT_TEAM;
		}
		for (const configuration of configurationsOf(
			project,
			target.pbxNativeTarget,
		)) {
			Object.assign(configuration.buildSettings, settings);
		}
		return config;
	});
}

function findAppTarget(project) {
	return Object.entries(project.pbxNativeTargetSection()).find(
		([key, target]) =>
			!key.endsWith("_comment") &&
			target.productType === '"com.apple.product-type.application"',
	);
}

function configurationsOf(project, target) {
	const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
	const configurations = project.pbxXCBuildConfigurationSection();
	return list.buildConfigurations.map(({ value }) => configurations[value]);
}

// The first configuration's: Debug and Release agree on these.
function buildSettingsOf(project, target) {
	return configurationsOf(project, target)[0].buildSettings;
}

function withShareActivity(config) {
	return withAndroidManifest(config, (config) => {
		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
			config.modResults,
		);
		const name = "expo.modules.sharetarget.ShareActivity";
		application.activity = (application.activity ?? []).filter(
			(activity) => activity.$["android:name"] !== name,
		);
		application.activity.push({
			$: {
				"android:name": name,
				"android:label": label(config),
				"android:exported": "true",
				"android:excludeFromRecents": "true",
				"android:noHistory": "true",
				"android:theme": "@android:style/Theme.Translucent.NoTitleBar",
			},
			"intent-filter": [
				{
					action: [{ $: { "android:name": "android.intent.action.SEND" } }],
					category: [
						{ $: { "android:name": "android.intent.category.DEFAULT" } },
					],
					data: [{ $: { "android:mimeType": "image/*" } }],
				},
			],
			"meta-data": [
				{
					$: {
						"android:name": "expo.modules.sharetarget.SCHEME",
						"android:value": config.scheme,
					},
				},
			],
		});
		return config;
	});
}

module.exports = (config) =>
	withShareActivity(
		withShareExtension(withAppGroup(withEasAppExtension(config))),
	);
