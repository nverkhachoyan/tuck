import Head from "expo-router/head";
import { Platform } from "react-native";
import { SITE_URL } from "./site";

const SITE_TITLE = "Tuck: Photo Markup";
const SITE_DESCRIPTION =
	"Blur, redact, caption, and mark up photos and screenshots in your browser. Every edit happens on your device: no account, no uploads, no watermark.";

/**
 * A page's browser tab title, and what search engines and link previews read
 * about it. The layout gives every page the site's; a page's own replaces
 * it. A page that names its `path` gives it as its canonical address. Only on
 * web: in an iOS build, Head also registers the screen with Handoff and
 * Spotlight.
 */
export function PageHead({
	title,
	description = SITE_DESCRIPTION,
	path,
	noindex = false,
}: {
	title?: string;
	description?: string;
	path?: string;
	noindex?: boolean;
}) {
	if (Platform.OS !== "web") return null;
	const shareTitle = title ? `${title} · Tuck` : SITE_TITLE;
	return (
		<Head>
			<title>{title ? `${title} · Tuck` : "Tuck"}</title>
			<meta name="description" content={description} />
			<meta property="og:title" content={shareTitle} />
			<meta property="og:description" content={description} />
			<meta name="twitter:title" content={shareTitle} />
			<meta name="twitter:description" content={description} />
			{path && <link rel="canonical" href={SITE_URL + path} />}
			{path && <meta property="og:url" content={SITE_URL + path} />}
			{noindex && <meta name="robots" content="noindex" />}
		</Head>
	);
}
