import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Editor, type EditorHost, LoadFonts } from "@/editor";
import type { EditorDocument } from "@/editor/core";
import { importPhoto, pickPhoto } from "@/photos/photoImport";
import { exportHref } from "@/projects/projectRoute";
import {
	addImage,
	previewUri,
	title as sessionTitle,
} from "@/session/appSession";
import { useAutosave } from "@/session/useAutosave";
import {
	latestSessionDocument,
	useProjectSession,
	useSessionProjectId,
} from "@/session/useProjectSession";
import { Button } from "@/ui/Button";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { colors, space, typography } from "@/ui/theme";
import { EditorOpening, leaveEditor } from "./EditorOpening";

export default function EditorScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const session = useProjectSession(id);

	if (session.status === "open") {
		// Text is laid out as the editor renders, so it waits for the fonts.
		return (
			<Suspense fallback={<EditorOpening />}>
				<LoadFonts />
				<OpenProject document={session.document} />
			</Suspense>
		);
	}

	if (session.status === "opening") return <EditorOpening />;

	return (
		<View role="main" style={styles.container}>
			<ScreenHeader
				backLabel="Back to projects"
				onBack={() => leaveEditor(router)}
			/>
			<View style={styles.status}>
				<Text style={styles.statusTitle}>
					{session.gone ? "This project wasn't kept" : "Couldn't open project"}
				</Text>
				<Text style={styles.statusMessage}>
					{session.gone
						? "A photo left without edits isn't saved as a project, and a deleted one is gone."
						: session.message}
				</Text>
				<View style={styles.statusActions}>
					{session.openElsewhere || session.gone ? (
						<Button
							label="Back to projects"
							onPress={() => leaveEditor(router)}
						/>
					) : null}
					{!session.gone && (
						<Button label="Try again" onPress={session.retry} />
					)}
				</View>
			</View>
		</View>
	);
}

// The open project, saved as it's edited.
function OpenProject({ document }: { document: EditorDocument }) {
	const router = useRouter();
	const focused = useIsFocused();
	const projectId = useSessionProjectId();
	const { error, retry } = useAutosave(
		projectId,
		document,
		latestSessionDocument,
	);
	const title = useMemo(
		() => sessionTitle(projectId, document),
		[projectId, document],
	);
	const host: EditorHost = {
		pickPhoto,
		importPhoto,
		addImage: (uri, opaque, preview) =>
			addImage(projectId, uri, opaque, preview),
		title,
		saveProblem:
			projectId === null
				? "This project couldn't be saved, so your edits won't be kept."
				: error,
		retrySave: projectId !== null ? retry : undefined,
		focused,
		leave: () => leaveEditor(router),
		openExport: () => router.push(exportHref(projectId)),
		previewUri:
			projectId !== null
				? (uri: string) => previewUri(projectId, uri)
				: undefined,
	};
	return <Editor document={document} host={host} />;
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
