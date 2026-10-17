import Constants from "expo-constants";
import { Linking, StyleSheet, View } from "react-native";
import { space } from "@/theme";
import { Button } from "@/ui/Button";
import {
	InfoPage,
	InlineLink,
	Paragraph,
	Section,
	SUPPORT_EMAIL,
} from "./InfoPage";

const version = Constants.expoConfig?.version;

export default function SupportScreen() {
	return (
		<InfoPage title="Support">
			<Section title="Get in touch">
				<Paragraph>
					Found a bug, or missing something? Email {SUPPORT_EMAIL}. Say which
					device you're on and what you were doing, and a screenshot helps.
				</Paragraph>
				<View style={styles.action}>
					<Button
						label="Email Support"
						icon="mail-outline"
						onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
					/>
				</View>
			</Section>

			<Section title="Where are my projects?">
				<Paragraph>
					On the device or browser you made them in. Tuck has no account, so
					projects don't sync between devices. On the web, they belong to the
					browser you used, and clearing its data for tuck.tools deletes them.
					Some browsers, Safari among them, also clear the data of sites you
					haven't opened in a while, so save or share an edit you want to keep.
				</Paragraph>
			</Section>

			<Section title="Saving to Photos doesn't work">
				<Paragraph>
					Tuck needs permission to add photos to your library. On iPhone, open
					Settings, then Apps, then Tuck, and set Photos to Add Photos Only or
					Full Access.
				</Paragraph>
			</Section>

			<Section title="Opening a photo from another app">
				<Paragraph>
					In Photos, or any app that shares images, tap Share and choose Tuck.
					If it isn't listed on iPhone, swipe to the end of the apps and tap
					More to add it.
				</Paragraph>
			</Section>

			<Section title="Which browsers work?">
				<Paragraph>
					Recent versions of Chrome, Edge, Firefox, and Safari, on a computer or
					a phone. If Tuck doesn't start, update your browser, or try another.
				</Paragraph>
			</Section>

			<Section title="Redact doesn't find anything on Android">
				<Paragraph>
					The first time, Android downloads the detection models through Google
					Play services. Stay online for a minute, then try again.
				</Paragraph>
			</Section>

			<Section title="Does Tuck cost anything?">
				<Paragraph>
					No. There's no subscription, no ads, and no watermark.
				</Paragraph>
			</Section>

			<Section title="More">
				<Paragraph>
					Read the <InlineLink to="/privacy">privacy policy</InlineLink> and the{" "}
					<InlineLink to="/licenses">licenses</InlineLink> for the open-source
					software and fonts in Tuck.
				</Paragraph>
				{version && <Paragraph muted>Tuck {version}</Paragraph>}
			</Section>
		</InfoPage>
	);
}

const styles = StyleSheet.create({
	action: {
		alignSelf: "flex-start",
		marginTop: space.xxs,
	},
});
