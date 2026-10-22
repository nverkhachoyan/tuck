import { type Href, Link, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space, typography } from "@/theme";
import { PageHead } from "./PageHead";
import { ScreenHeader } from "./ScreenHeader";

// A line of running text this wide reads comfortably.
const MAX_WIDTH = 640;

/**
 * A page of reading, such as the privacy policy: a header with Back and the
 * page's name, then text in one column. Opened from a link or the address
 * bar, with nothing behind it, Back goes home.
 */
export function InfoPage({
	title,
	description,
	path,
	noindex,
	children,
}: {
	title: string;
	children: ReactNode;
} & Omit<Parameters<typeof PageHead>[0], "title">) {
	const router = useRouter();
	const { bottom } = useSafeAreaInsets();
	return (
		<View style={styles.screen}>
			<PageHead
				title={title}
				description={description}
				path={path}
				noindex={noindex}
			/>
			<ScreenHeader
				title={title}
				onBack={() =>
					router.canGoBack() ? router.back() : router.replace("/")
				}
			/>
			<ScrollView
				role="main"
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: space.xl + bottom },
				]}
			>
				{children}
			</ScrollView>
		</View>
	);
}

export function Section({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<View style={styles.section}>
			<Text style={styles.heading} accessibilityRole="header">
				{title}
			</Text>
			{children}
		</View>
	);
}

export function Paragraph({
	children,
	muted = false,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return (
		<Text selectable style={[styles.paragraph, muted && styles.muted]}>
			{children}
		</Text>
	);
}

/** A point in a list, after a bullet. */
export function Item({ children }: { children: ReactNode }) {
	return (
		<View style={styles.item}>
			<Text style={styles.paragraph}>•</Text>
			<Text selectable style={[styles.paragraph, styles.itemText]}>
				{children}
			</Text>
		</View>
	);
}

/**
 * A link inside a paragraph: to another page of the app, or out to a web
 * address or an email (`mailto:`).
 */
export function InlineLink({
	to,
	children,
}: {
	to: Href | `https:${string}` | `mailto:${string}`;
	children: ReactNode;
}) {
	const external =
		typeof to === "string" &&
		(to.startsWith("https:") || to.startsWith("mailto:"));
	return (
		<Link
			href={to}
			style={styles.link}
			// On web, the browser opens it, in a new tab.
			{...(external && { target: "_blank", rel: "noopener" })}
		>
			{children}
		</Link>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
	},
	content: {
		width: "100%",
		maxWidth: MAX_WIDTH,
		alignSelf: "center",
		paddingHorizontal: space.md,
		paddingTop: space.xs,
		gap: space.lg,
	},
	section: {
		gap: space.xs,
	},
	heading: {
		...typography.title,
		color: colors.textPrimary,
	},
	paragraph: {
		...typography.body,
		lineHeight: 22,
		color: colors.textPrimary,
	},
	muted: {
		color: colors.textSecondary,
	},
	item: {
		flexDirection: "row",
		gap: space.xs,
		paddingLeft: space.xxs,
	},
	itemText: {
		flex: 1,
	},
	link: {
		textDecorationLine: "underline",
	},
});
