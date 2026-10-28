import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Editor, getSession, useSession } from "@/editor";
import type { EditorDocument } from "@/model/document";
import { Button } from "@/ui/Button";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { colors, space, typography } from "@/ui/theme";
import { useAutosave } from "./session/useAutosave";
import { useProjectSession } from "./session/useProjectSession";

export default function EditorScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const session = useProjectSession(id);

	if (session.status === "open") {
		return <OpenProject document={session.document} />;
	}

	return (
		<View role="main" style={styles.container}>
			<ScreenHeader
				backLabel="Back to projects"
				onBack={() => leaveEditor(router)}
			/>
			<View style={styles.status}>
				{session.status === "opening" ? (
					<ActivityIndicator color={colors.textSecondary} />
				) : (
					<>
						<Text style={styles.statusTitle}>Couldn't open project</Text>
						<Text style={styles.statusMessage}>{session.message}</Text>
						<View style={styles.statusActions}>
							{session.openElsewhere ? (
								<Button
									label="Back to projects"
									onPress={() => leaveEditor(router)}
								/>
							) : null}
							<Button label="Try again" onPress={session.retry} />
						</View>
					</>
				)}
			</View>
		</View>
	);
}

// Opened from a link or a reload, there's nothing behind the editor; the
// welcome screen still ends the session.
function leaveEditor(router: ReturnType<typeof useRouter>) {
	if (router.canGoBack()) router.back();
	else router.replace("/");
}

// For a save as the app leaves the foreground, or a pick finished, before
// React has rendered.
const latestDocument = () => getSession().document;

// The open project, saved as it's edited.
function OpenProject({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const projectId = useSession((session) => session.key);
	const { error, retry } = useAutosave(projectId, document, latestDocument);
	return (
		<Editor
			document={document}
			saveProblem={
				projectId === null
					? "This project couldn't be saved, so your edits won't be kept."
					: error
			}
			onRetrySave={projectId !== null ? retry : undefined}
			onLeave={() => leaveEditor(router)}
		/>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	status: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		padding: 24,
	},
	statusTitle: {
		...typography.title,
		color: colors.textPrimary,
	},
	statusMessage: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
		maxWidth: 320,
	},
	statusActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: space.sm,
		marginTop: space.sm,
	},
});
