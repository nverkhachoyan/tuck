import { APACHE_2_0, BSD_3_CLAUSE, MIT, OFL_1_1 } from "./licenseTexts";

// The fonts, images, and code Tuck ships that others made, with each one's
// copyright notice. The notices are copied from the packages' license files.

export type LicenseId = keyof typeof licenses;

export const licenses = {
	"OFL-1.1": { name: "SIL Open Font License 1.1", text: OFL_1_1 },
	"Apache-2.0": { name: "Apache License 2.0", text: APACHE_2_0 },
	MIT: { name: "MIT License", text: MIT },
	"BSD-3-Clause": { name: "BSD 3-Clause License", text: BSD_3_CLAUSE },
};

type Credit = { name: string; notice: string; license: LicenseId };

export const creditGroups: { title: string; credits: Credit[] }[] = [
	{
		title: "Fonts",
		credits: [
			{
				name: "Anton",
				notice:
					"Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git)",
				license: "OFL-1.1",
			},
			{
				name: "Courier Prime",
				notice:
					"Copyright 2015 The Courier Prime Project Authors (https://github.com/quoteunquoteapps/CourierPrime)",
				license: "OFL-1.1",
			},
			{
				name: "Montserrat",
				notice:
					"Copyright 2024 The Montserrat.Git Project Authors (https://github.com/JulietaUla/Montserrat.git)",
				license: "OFL-1.1",
			},
			{
				name: "Playfair Display",
				notice:
					'Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name "Playfair Display"',
				license: "OFL-1.1",
			},
			{
				name: "Permanent Marker",
				notice: "Copyright (c) 2010 by Font Diner, Inc. All rights reserved.",
				license: "Apache-2.0",
			},
		],
	},
	{
		title: "Icons and stickers",
		credits: [
			{
				name: "Noto Emoji",
				notice: "Copyright Google Inc.",
				license: "Apache-2.0",
			},
			{
				name: "Ionicons",
				notice: "Copyright (c) 2015-present Ionic (http://ionic.io/)",
				license: "MIT",
			},
			{
				name: "Material Design Icons",
				notice: "Copyright (c) Pictogrammers",
				license: "Apache-2.0",
			},
			{
				name: "react-native-vector-icons",
				notice:
					"Copyright (c) 2015 Joel Arvidsson, Copyright (c) 2020 650 Industries",
				license: "MIT",
			},
		],
	},
	{
		title: "Detection",
		credits: [
			{
				name: "MediaPipe, with the BlazeFace and MagicTouch models",
				notice: "Copyright The MediaPipe Authors",
				license: "Apache-2.0",
			},
			{
				name: "Tesseract and Tesseract.js, with Tesseract's English model",
				notice: "Copyright The Tesseract and Tesseract.js authors",
				license: "Apache-2.0",
			},
		],
	},
	{
		title: "Software",
		credits: [
			{
				name: "Skia and CanvasKit",
				notice: "Copyright (c) 2011 Google Inc. All rights reserved.",
				license: "BSD-3-Clause",
			},
			{
				name: "React Native Skia",
				notice: "Copyright 2021-present, Shopify Inc.",
				license: "MIT",
			},
			{
				name: "React, React DOM, and React Native",
				notice: "Copyright (c) Meta Platforms, Inc. and affiliates.",
				license: "MIT",
			},
			{
				name: "React Native Web",
				notice: "Copyright (c) Nicolas Gallagher.",
				license: "MIT",
			},
			{
				name: "Expo and its modules",
				notice: "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)",
				license: "MIT",
			},
			{
				name: "React Native Gesture Handler, Reanimated, and Screens",
				notice: "Copyright (c) 2016 Software Mansion <swmansion.com>",
				license: "MIT",
			},
			{
				name: "React Native Worklets",
				notice: "Copyright (c) 2024 nobody",
				license: "MIT",
			},
			{
				name: "React Native Safe Area Context",
				notice: "Copyright (c) 2019 Th3rd Wave",
				license: "MIT",
			},
			{
				name: "Zustand",
				notice: "Copyright (c) 2019 Paul Henschel",
				license: "MIT",
			},
		],
	},
];
