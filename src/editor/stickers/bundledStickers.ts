// The bundled stickers: emoji from Google's Noto Emoji, whose images are
// under the Apache License 2.0 (`assets/stickers/LICENSE-APACHE`). Each is a 512px
// PNG with a small thumbnail for the sticker sheet, both fetched by
// `scripts/fetch-stickers.mjs`, which reads the file names below.

export const stickerCategories = [
	"faces",
	"hands",
	"love",
	"party",
	"things",
] as const;
export type StickerCategory = (typeof stickerCategories)[number];

export const STICKER_CATEGORY_LABELS: Record<StickerCategory, string> = {
	faces: "Faces",
	hands: "Hands",
	love: "Love",
	party: "Party",
	things: "Things",
};

// Every sticker image is this many pixels square.
export const STICKER_SIZE = 512;

export type Sticker = {
	label: string;
	image: number;
	thumbnail: number;
};

export const STICKERS: Record<StickerCategory, Sticker[]> = {
	faces: [
		{
			label: "Grinning face",
			image: require("../../../assets/stickers/emoji_u1f600.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f600.webp"),
		},
		{
			label: "Grinning face with big eyes",
			image: require("../../../assets/stickers/emoji_u1f603.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f603.webp"),
		},
		{
			label: "Grinning face with smiling eyes",
			image: require("../../../assets/stickers/emoji_u1f604.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f604.webp"),
		},
		{
			label: "Beaming face",
			image: require("../../../assets/stickers/emoji_u1f601.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f601.webp"),
		},
		{
			label: "Laughing face",
			image: require("../../../assets/stickers/emoji_u1f606.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f606.webp"),
		},
		{
			label: "Grinning face with sweat",
			image: require("../../../assets/stickers/emoji_u1f605.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f605.webp"),
		},
		{
			label: "Rolling on the floor laughing",
			image: require("../../../assets/stickers/emoji_u1f923.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f923.webp"),
		},
		{
			label: "Face with tears of joy",
			image: require("../../../assets/stickers/emoji_u1f602.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f602.webp"),
		},
		{
			label: "Slightly smiling face",
			image: require("../../../assets/stickers/emoji_u1f642.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f642.webp"),
		},
		{
			label: "Upside-down face",
			image: require("../../../assets/stickers/emoji_u1f643.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f643.webp"),
		},
		{
			label: "Melting face",
			image: require("../../../assets/stickers/emoji_u1fae0.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1fae0.webp"),
		},
		{
			label: "Winking face",
			image: require("../../../assets/stickers/emoji_u1f609.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f609.webp"),
		},
		{
			label: "Smiling face with smiling eyes",
			image: require("../../../assets/stickers/emoji_u1f60a.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f60a.webp"),
		},
		{
			label: "Smiling face with halo",
			image: require("../../../assets/stickers/emoji_u1f607.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f607.webp"),
		},
		{
			label: "Smiling face with hearts",
			image: require("../../../assets/stickers/emoji_u1f970.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f970.webp"),
		},
		{
			label: "Smiling face with heart eyes",
			image: require("../../../assets/stickers/emoji_u1f60d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f60d.webp"),
		},
		{
			label: "Star-struck",
			image: require("../../../assets/stickers/emoji_u1f929.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f929.webp"),
		},
		{
			label: "Face blowing a kiss",
			image: require("../../../assets/stickers/emoji_u1f618.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f618.webp"),
		},
		{
			label: "Face savoring food",
			image: require("../../../assets/stickers/emoji_u1f60b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f60b.webp"),
		},
		{
			label: "Winking face with tongue",
			image: require("../../../assets/stickers/emoji_u1f61c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f61c.webp"),
		},
		{
			label: "Zany face",
			image: require("../../../assets/stickers/emoji_u1f92a.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f92a.webp"),
		},
		{
			label: "Thinking face",
			image: require("../../../assets/stickers/emoji_u1f914.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f914.webp"),
		},
		{
			label: "Face with raised eyebrow",
			image: require("../../../assets/stickers/emoji_u1f928.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f928.webp"),
		},
		{
			label: "Face with rolling eyes",
			image: require("../../../assets/stickers/emoji_u1f644.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f644.webp"),
		},
		{
			label: "Smirking face",
			image: require("../../../assets/stickers/emoji_u1f60f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f60f.webp"),
		},
		{
			label: "Grimacing face",
			image: require("../../../assets/stickers/emoji_u1f62c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f62c.webp"),
		},
		{
			label: "Sleeping face",
			image: require("../../../assets/stickers/emoji_u1f634.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f634.webp"),
		},
		{
			label: "Partying face",
			image: require("../../../assets/stickers/emoji_u1f973.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f973.webp"),
		},
		{
			label: "Smiling face with sunglasses",
			image: require("../../../assets/stickers/emoji_u1f60e.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f60e.webp"),
		},
		{
			label: "Nerd face",
			image: require("../../../assets/stickers/emoji_u1f913.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f913.webp"),
		},
		{
			label: "Flushed face",
			image: require("../../../assets/stickers/emoji_u1f633.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f633.webp"),
		},
		{
			label: "Pleading face",
			image: require("../../../assets/stickers/emoji_u1f97a.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f97a.webp"),
		},
		{
			label: "Loudly crying face",
			image: require("../../../assets/stickers/emoji_u1f62d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f62d.webp"),
		},
		{
			label: "Face screaming in fear",
			image: require("../../../assets/stickers/emoji_u1f631.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f631.webp"),
		},
		{
			label: "Enraged face",
			image: require("../../../assets/stickers/emoji_u1f621.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f621.webp"),
		},
		{
			label: "Exploding head",
			image: require("../../../assets/stickers/emoji_u1f92f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f92f.webp"),
		},
		{
			label: "Clown face",
			image: require("../../../assets/stickers/emoji_u1f921.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f921.webp"),
		},
		{
			label: "Ghost",
			image: require("../../../assets/stickers/emoji_u1f47b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f47b.webp"),
		},
		{
			label: "Skull",
			image: require("../../../assets/stickers/emoji_u1f480.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f480.webp"),
		},
	],
	hands: [
		{
			label: "Thumbs up",
			image: require("../../../assets/stickers/emoji_u1f44d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f44d.webp"),
		},
		{
			label: "Thumbs down",
			image: require("../../../assets/stickers/emoji_u1f44e.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f44e.webp"),
		},
		{
			label: "OK hand",
			image: require("../../../assets/stickers/emoji_u1f44c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f44c.webp"),
		},
		{
			label: "Victory hand",
			image: require("../../../assets/stickers/emoji_u270c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u270c.webp"),
		},
		{
			label: "Crossed fingers",
			image: require("../../../assets/stickers/emoji_u1f91e.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f91e.webp"),
		},
		{
			label: "Love-you gesture",
			image: require("../../../assets/stickers/emoji_u1f91f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f91f.webp"),
		},
		{
			label: "Sign of the horns",
			image: require("../../../assets/stickers/emoji_u1f918.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f918.webp"),
		},
		{
			label: "Pointing left",
			image: require("../../../assets/stickers/emoji_u1f448.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f448.webp"),
		},
		{
			label: "Pointing right",
			image: require("../../../assets/stickers/emoji_u1f449.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f449.webp"),
		},
		{
			label: "Pointing up",
			image: require("../../../assets/stickers/emoji_u1f446.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f446.webp"),
		},
		{
			label: "Pointing down",
			image: require("../../../assets/stickers/emoji_u1f447.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f447.webp"),
		},
		{
			label: "Waving hand",
			image: require("../../../assets/stickers/emoji_u1f44b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f44b.webp"),
		},
		{
			label: "Clapping hands",
			image: require("../../../assets/stickers/emoji_u1f44f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f44f.webp"),
		},
		{
			label: "Raising hands",
			image: require("../../../assets/stickers/emoji_u1f64c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f64c.webp"),
		},
		{
			label: "Folded hands",
			image: require("../../../assets/stickers/emoji_u1f64f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f64f.webp"),
		},
		{
			label: "Flexed biceps",
			image: require("../../../assets/stickers/emoji_u1f4aa.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4aa.webp"),
		},
		{
			label: "Heart hands",
			image: require("../../../assets/stickers/emoji_u1faf6.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1faf6.webp"),
		},
		{
			label: "Handshake",
			image: require("../../../assets/stickers/emoji_u1f91d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f91d.webp"),
		},
	],
	love: [
		{
			label: "Red heart",
			image: require("../../../assets/stickers/emoji_u2764.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2764.webp"),
		},
		{
			label: "Orange heart",
			image: require("../../../assets/stickers/emoji_u1f9e1.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f9e1.webp"),
		},
		{
			label: "Yellow heart",
			image: require("../../../assets/stickers/emoji_u1f49b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f49b.webp"),
		},
		{
			label: "Green heart",
			image: require("../../../assets/stickers/emoji_u1f49a.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f49a.webp"),
		},
		{
			label: "Blue heart",
			image: require("../../../assets/stickers/emoji_u1f499.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f499.webp"),
		},
		{
			label: "Purple heart",
			image: require("../../../assets/stickers/emoji_u1f49c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f49c.webp"),
		},
		{
			label: "Pink heart",
			image: require("../../../assets/stickers/emoji_u1fa77.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1fa77.webp"),
		},
		{
			label: "Black heart",
			image: require("../../../assets/stickers/emoji_u1f5a4.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f5a4.webp"),
		},
		{
			label: "White heart",
			image: require("../../../assets/stickers/emoji_u1f90d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f90d.webp"),
		},
		{
			label: "Broken heart",
			image: require("../../../assets/stickers/emoji_u1f494.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f494.webp"),
		},
		{
			label: "Heart on fire",
			image: require("../../../assets/stickers/emoji_u2764_200d_1f525.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2764_200d_1f525.webp"),
		},
		{
			label: "Two hearts",
			image: require("../../../assets/stickers/emoji_u1f495.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f495.webp"),
		},
		{
			label: "Sparkling heart",
			image: require("../../../assets/stickers/emoji_u1f496.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f496.webp"),
		},
		{
			label: "Heart with arrow",
			image: require("../../../assets/stickers/emoji_u1f498.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f498.webp"),
		},
		{
			label: "Heart with ribbon",
			image: require("../../../assets/stickers/emoji_u1f49d.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f49d.webp"),
		},
		{
			label: "Kiss mark",
			image: require("../../../assets/stickers/emoji_u1f48b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f48b.webp"),
		},
		{
			label: "Rose",
			image: require("../../../assets/stickers/emoji_u1f339.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f339.webp"),
		},
		{
			label: "Love letter",
			image: require("../../../assets/stickers/emoji_u1f48c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f48c.webp"),
		},
	],
	party: [
		{
			label: "Party popper",
			image: require("../../../assets/stickers/emoji_u1f389.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f389.webp"),
		},
		{
			label: "Confetti ball",
			image: require("../../../assets/stickers/emoji_u1f38a.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f38a.webp"),
		},
		{
			label: "Balloon",
			image: require("../../../assets/stickers/emoji_u1f388.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f388.webp"),
		},
		{
			label: "Birthday cake",
			image: require("../../../assets/stickers/emoji_u1f382.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f382.webp"),
		},
		{
			label: "Wrapped gift",
			image: require("../../../assets/stickers/emoji_u1f381.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f381.webp"),
		},
		{
			label: "Clinking glasses",
			image: require("../../../assets/stickers/emoji_u1f942.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f942.webp"),
		},
		{
			label: "Bottle with popping cork",
			image: require("../../../assets/stickers/emoji_u1f37e.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f37e.webp"),
		},
		{
			label: "Clinking beer mugs",
			image: require("../../../assets/stickers/emoji_u1f37b.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f37b.webp"),
		},
		{
			label: "Fireworks",
			image: require("../../../assets/stickers/emoji_u1f386.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f386.webp"),
		},
		{
			label: "Sparkles",
			image: require("../../../assets/stickers/emoji_u2728.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2728.webp"),
		},
		{
			label: "Mirror ball",
			image: require("../../../assets/stickers/emoji_u1faa9.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1faa9.webp"),
		},
		{
			label: "Musical note",
			image: require("../../../assets/stickers/emoji_u1f3b5.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f3b5.webp"),
		},
		{
			label: "Trophy",
			image: require("../../../assets/stickers/emoji_u1f3c6.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f3c6.webp"),
		},
		{
			label: "Gold medal",
			image: require("../../../assets/stickers/emoji_u1f947.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f947.webp"),
		},
		{
			label: "Crown",
			image: require("../../../assets/stickers/emoji_u1f451.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f451.webp"),
		},
		{
			label: "Jack-o-lantern",
			image: require("../../../assets/stickers/emoji_u1f383.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f383.webp"),
		},
		{
			label: "Christmas tree",
			image: require("../../../assets/stickers/emoji_u1f384.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f384.webp"),
		},
		{
			label: "Pizza",
			image: require("../../../assets/stickers/emoji_u1f355.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f355.webp"),
		},
	],
	things: [
		{
			label: "Fire",
			image: require("../../../assets/stickers/emoji_u1f525.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f525.webp"),
		},
		{
			label: "Hundred points",
			image: require("../../../assets/stickers/emoji_u1f4af.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4af.webp"),
		},
		{
			label: "Star",
			image: require("../../../assets/stickers/emoji_u2b50.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2b50.webp"),
		},
		{
			label: "Glowing star",
			image: require("../../../assets/stickers/emoji_u1f31f.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f31f.webp"),
		},
		{
			label: "High voltage",
			image: require("../../../assets/stickers/emoji_u26a1.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u26a1.webp"),
		},
		{
			label: "Collision",
			image: require("../../../assets/stickers/emoji_u1f4a5.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4a5.webp"),
		},
		{
			label: "Dizzy",
			image: require("../../../assets/stickers/emoji_u1f4ab.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4ab.webp"),
		},
		{
			label: "Speech balloon",
			image: require("../../../assets/stickers/emoji_u1f4ac.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4ac.webp"),
		},
		{
			label: "Thought balloon",
			image: require("../../../assets/stickers/emoji_u1f4ad.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4ad.webp"),
		},
		{
			label: "Zzz",
			image: require("../../../assets/stickers/emoji_u1f4a4.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4a4.webp"),
		},
		{
			label: "Exclamation mark",
			image: require("../../../assets/stickers/emoji_u2757.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2757.webp"),
		},
		{
			label: "Question mark",
			image: require("../../../assets/stickers/emoji_u2753.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2753.webp"),
		},
		{
			label: "Check mark",
			image: require("../../../assets/stickers/emoji_u2705.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2705.webp"),
		},
		{
			label: "Cross mark",
			image: require("../../../assets/stickers/emoji_u274c.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u274c.webp"),
		},
		{
			label: "Warning",
			image: require("../../../assets/stickers/emoji_u26a0.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u26a0.webp"),
		},
		{
			label: "Prohibited",
			image: require("../../../assets/stickers/emoji_u1f6ab.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f6ab.webp"),
		},
		{
			label: "Pushpin",
			image: require("../../../assets/stickers/emoji_u1f4cc.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4cc.webp"),
		},
		{
			label: "Round pushpin",
			image: require("../../../assets/stickers/emoji_u1f4cd.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4cd.webp"),
		},
		{
			label: "Eyes",
			image: require("../../../assets/stickers/emoji_u1f440.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f440.webp"),
		},
		{
			label: "Bullseye",
			image: require("../../../assets/stickers/emoji_u1f3af.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f3af.webp"),
		},
		{
			label: "Light bulb",
			image: require("../../../assets/stickers/emoji_u1f4a1.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4a1.webp"),
		},
		{
			label: "Money bag",
			image: require("../../../assets/stickers/emoji_u1f4b0.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f4b0.webp"),
		},
		{
			label: "Rocket",
			image: require("../../../assets/stickers/emoji_u1f680.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f680.webp"),
		},
		{
			label: "Rainbow",
			image: require("../../../assets/stickers/emoji_u1f308.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f308.webp"),
		},
		{
			label: "Sun",
			image: require("../../../assets/stickers/emoji_u2600.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u2600.webp"),
		},
		{
			label: "Crescent moon",
			image: require("../../../assets/stickers/emoji_u1f319.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f319.webp"),
		},
		{
			label: "Cherry blossom",
			image: require("../../../assets/stickers/emoji_u1f338.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f338.webp"),
		},
		{
			label: "Four leaf clover",
			image: require("../../../assets/stickers/emoji_u1f340.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f340.webp"),
		},
		{
			label: "Dog face",
			image: require("../../../assets/stickers/emoji_u1f436.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f436.webp"),
		},
		{
			label: "Cat face",
			image: require("../../../assets/stickers/emoji_u1f431.png"),
			thumbnail: require("../../../assets/stickers/thumbnails/emoji_u1f431.webp"),
		},
	],
};
