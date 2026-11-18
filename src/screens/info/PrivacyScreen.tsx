import { SUPPORT_EMAIL } from "@/site/site";
import { InfoPage, InlineLink, Item, Paragraph, Section } from "./InfoPage";

const ML_KIT_DISCLOSURE =
	"https://developers.google.com/ml-kit/android-data-disclosure";

export default function PrivacyScreen() {
	return (
		<InfoPage
			title="Privacy"
			path="/privacy"
			description="Tuck edits your photos on your own device. Nothing is uploaded, and nothing about you is collected: no account, no analytics, no ads, and no tracking."
		>
			<Paragraph muted>Last updated November 18, 2026</Paragraph>

			<Section title="The short version">
				<Paragraph>
					Tuck edits your photos on your own device. They're never uploaded, and
					we don't collect anything about you. There's no account, no analytics,
					no ads, and no tracking.
				</Paragraph>
			</Section>

			<Section title="Your photos and projects">
				<Paragraph>
					Everything you make in Tuck stays where you made it: the photos you
					open, your edits, your projects, and the stickers you save.
				</Paragraph>
				<Item>
					On iPhone and Android, they're kept in the app's own storage. Your
					device's backup (iCloud or Google) can include them, under your
					account.
				</Item>
				<Item>
					On the web, they're kept in your browser's storage for tuck.tools, and
					never sent to our servers.
				</Item>
				<Item>
					When you save, copy, or share an edit, it goes only where you send it.
				</Item>
				<Paragraph>
					To delete them, delete your projects in Tuck, or remove the app. On
					the web, clearing the site data for tuck.tools deletes everything.
				</Paragraph>
			</Section>

			<Section title="Access to your photo library">
				<Paragraph>
					You choose photos with your system's photo picker, which gives Tuck
					only the ones you pick. Tuck reads your clipboard only when you paste.
					Saving to your library asks for permission to add photos, not to see
					them. A photo you share to Tuck from another app is copied into Tuck's
					own storage.
				</Paragraph>
			</Section>

			<Section title="Finding faces and text">
				<Paragraph>
					Redact can find faces and text for you, and Cut finds the subjects and
					objects in a photo. This runs on your device too: Apple's Vision on
					iPhone and iPad, Google's ML Kit on Android, MediaPipe and Tesseract
					in the browser, and Segment Anything on all three. Your photos aren't
					sent anywhere to be analyzed.
				</Paragraph>
				<Paragraph>
					On Android, ML Kit is part of Google Play services, which sends Google
					diagnostic information about how it runs: the device model and system
					version, Tuck's name and version, how long detection took, and an
					identifier for the installation that isn't meant to identify you. It
					contains nothing from your photos and no face data. Google describes
					this in its{" "}
					<InlineLink to={ML_KIT_DISCLOSURE}>ML Kit data disclosure</InlineLink>
					.
				</Paragraph>
			</Section>

			<Section title="Face data">
				<Paragraph>
					Tuck doesn't collect face data. When you tap Find in Redact, it looks
					for faces in the photo you're editing so you can cover them.
				</Paragraph>
				<Item>
					What it uses: only a rectangle around each face, its position and size
					in the photo. Tuck doesn't read facial features, landmarks, or face
					geometry, doesn't use the TrueDepth camera or Face ID, and doesn't
					recognize or identify anyone.
				</Item>
				<Item>
					How it's used: only to show you where the faces are, so you can choose
					which to cover. It isn't used for anything else: not for ads,
					analytics, tracking, or training.
				</Item>
				<Item>
					Where it's stored: the rectangles are held in memory on your device
					while you choose, and never written to storage. They're discarded when
					you leave Find, switch photos, or close the project.
				</Item>
				<Item>
					Retention and deletion: a face you choose to cover becomes a redaction
					box in your project, a plain shape with a position and size that
					doesn't record it was a face. It stays on your device with the project
					until you remove the box, delete the project, or remove the app.
				</Item>
				<Item>
					Sharing: face data is never sent off your device, to us or to anyone
					else, and never shared with third parties.
				</Item>
			</Section>

			<Section title="The website">
				<Paragraph>
					tuck.tools is hosted by Vercel. Like any web host, it handles basic
					request details, such as your IP address and browser, to deliver the
					site and protect it from abuse. Tuck doesn't add analytics or cookies
					of its own.
				</Paragraph>
			</Section>

			<Section title="The App Store and Google Play">
				<Paragraph>
					Apple and Google share statistics with us, such as download counts and
					crash reports from people who've agreed to share them. These never
					identify you, and they're covered by Apple's and Google's own privacy
					policies.
				</Paragraph>
			</Section>

			<Section title="Emailing us">
				<Paragraph>
					If you email {SUPPORT_EMAIL}, we receive your address and your
					message, and use them only to reply. Ask, and we'll delete them.
				</Paragraph>
			</Section>

			<Section title="Children">
				<Paragraph>
					Tuck isn't directed at children under 13, and it collects nothing from
					anyone, children included.
				</Paragraph>
			</Section>

			<Section title="Changes">
				<Paragraph>
					If this policy changes, the new version will be posted here with a new
					date.
				</Paragraph>
			</Section>

			<Section title="Contact">
				<Paragraph>
					Questions about privacy go to{" "}
					<InlineLink to={`mailto:${SUPPORT_EMAIL}`}>
						{SUPPORT_EMAIL}
					</InlineLink>
					.
				</Paragraph>
			</Section>
		</InfoPage>
	);
}
