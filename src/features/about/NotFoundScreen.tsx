import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { space } from "@/theme";
import { Button } from "@/ui/Button";
import { InfoPage, Paragraph, Section } from "./InfoPage";

export default function NotFoundScreen() {
	const router = useRouter();
	return (
		<InfoPage title="Not Found">
			<Section title="There's nothing here">
				<Paragraph>
					This address isn't a page of Tuck. The link may be mistyped, or the
					page may have moved.
				</Paragraph>
				<View style={styles.action}>
					<Button
						label="Open Tuck"
						variant="primary"
						onPress={() => router.replace("/")}
					/>
				</View>
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
