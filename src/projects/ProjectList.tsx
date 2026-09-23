import Ionicons from "@expo/vector-icons/Ionicons";
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { colors } from "@/theme";
import { IconButton } from "@/ui/IconButton";
import type { ProjectSummary } from "./projectFile";

/** Saved projects to pick up again, most recent first. */
export function ProjectList({
	projects,
	disabled,
	onOpen,
	onDelete,
}: {
	projects: ProjectSummary[];
	disabled: boolean;
	onOpen: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<View style={styles.container}>
			<Text style={styles.heading}>Recent</Text>
			<ScrollView contentContainerStyle={styles.rows}>
				{projects.map((project) => {
					const unavailable = project.status === "unavailable";
					const label = unavailable ? "Unavailable project" : project.label;
					const detail = unavailable
						? "Cannot open with this app version"
						: `Edited ${formatDate(project.updatedAt)}`;
					return (
						<View key={project.id} style={styles.row}>
							<Pressable
								disabled={disabled || unavailable}
								onPress={() => onOpen(project.id)}
								accessibilityRole="button"
								accessibilityLabel={`${label}, ${detail}`}
								style={({ pressed }) => [
									styles.open,
									pressed && styles.pressed,
								]}
							>
								<Thumbnail url={unavailable ? null : project.thumbnail} />
								<View style={styles.text}>
									<Text style={styles.label} numberOfLines={1}>
										{label}
									</Text>
									<Text style={styles.date}>{detail}</Text>
								</View>
							</Pressable>
							<IconButton
								icon="trash-outline"
								label={`Delete ${label}`}
								tone="danger"
								disabled={disabled}
								onPress={() => onDelete(project.id)}
							/>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}

/** The project's last closed look; a placeholder until it has one. */
function Thumbnail({ url }: { url: string | null }) {
	if (url) return <Image source={{ uri: url }} style={styles.thumbnail} />;
	return (
		<View style={styles.thumbnail}>
			<Ionicons name="image-outline" size={20} color={colors.textSecondary} />
		</View>
	);
}

function formatDate(time: number) {
	return new Date(time).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		gap: 12,
	},
	heading: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
		textTransform: "uppercase",
	},
	rows: {
		gap: 8,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingRight: 16,
		borderRadius: 12,
		backgroundColor: colors.surface,
	},
	open: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingLeft: 8,
		paddingVertical: 8,
	},
	thumbnail: {
		width: 48,
		height: 48,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.border,
	},
	text: {
		flex: 1,
		gap: 2,
	},
	pressed: {
		opacity: 0.7,
	},
	label: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	date: {
		fontSize: 13,
		color: colors.textSecondary,
	},
});
