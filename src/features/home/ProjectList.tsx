import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	Image,
	type LayoutChangeEvent,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import type { ProjectSummary } from "@/projects/projectFile";
import { colors, fonts, radii, webTransition } from "@/theme";
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";
import { TextButton } from "@/ui/TextButton";

const GAP = 12;
const MIN_CARD_WIDTH = 150;
const MAX_COLUMNS = 4;
// Around the print inside its card, as a share of the card's width.
const MAT = 0.12;
// Cards after this many appear together, so a long list doesn't trickle in.
const STAGGERED = 8;

type ProjectListProps = {
	projects: ProjectSummary[];
	disabled: boolean;
	onOpen: (id: string) => void;
	onDelete: (id: string) => void;
};

export function ProjectList({
	projects,
	disabled,
	onOpen,
	onDelete,
}: ProjectListProps) {
	const [editing, setEditing] = useState(false);
	const [width, setWidth] = useState(0);
	// Leaving the screen ends editing, so coming back shows the plain grid.
	useFocusEffect(useCallback(() => () => setEditing(false), []));
	const columns = Math.max(
		1,
		Math.min(MAX_COLUMNS, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP))),
	);
	const cardWidth = (width - GAP * (columns - 1)) / columns;

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.heading} accessibilityRole="header">
					Recent
				</Text>
				<TextButton
					label={editing ? "Done" : "Edit"}
					tone={editing ? "accent" : "default"}
					onPress={() => setEditing((on) => !on)}
				/>
			</View>
			<ScrollView
				contentContainerStyle={styles.grid}
				showsVerticalScrollIndicator={false}
				onLayout={(event: LayoutChangeEvent) =>
					setWidth(event.nativeEvent.layout.width)
				}
			>
				{width > 0 &&
					projects.map((project, index) => (
						<ProjectCard
							key={project.id}
							project={project}
							width={cardWidth}
							order={Math.min(index, STAGGERED)}
							editing={editing}
							disabled={disabled}
							onOpen={onOpen}
							onDelete={onDelete}
						/>
					))}
			</ScrollView>
		</View>
	);
}

function ProjectCard({
	project,
	width,
	order,
	editing,
	disabled,
	onOpen,
	onDelete,
}: {
	project: ProjectSummary;
	width: number;
	order: number;
} & Pick<ProjectListProps, "disabled" | "onOpen" | "onDelete"> & {
		editing: boolean;
	}) {
	// Tracked around the card and its delete button together, so moving
	// onto the button doesn't hide it.
	const [pointerOver, setPointerOver] = useState(false);
	const unavailable = project.status === "unavailable";
	const label = unavailable ? "Unavailable project" : project.label;
	const detail = unavailable
		? "Needs a newer version of the app"
		: formatDate(project.updatedAt);

	return (
		<Animated.View
			entering={FadeInDown.delay(order * 45).duration(420)}
			style={{ width }}
			onPointerEnter={(event) => {
				if (event.nativeEvent.pointerType === "mouse") setPointerOver(true);
			}}
			onPointerLeave={() => setPointerOver(false)}
		>
			<Pressable
				disabled={disabled || unavailable}
				onPress={() => {
					if (!editing) onOpen(project.id);
				}}
				onLongPress={() => onDelete(project.id)}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${detail}`}
				accessibilityHint={editing ? undefined : "Opens the project"}
				style={styles.card}
			>
				{(state) => {
					const { pressed, hovered } = interaction(state);
					return (
						<>
							<View
								style={[
									styles.well,
									{ height: width },
									webTransition,
									hovered && styles.wellHovered,
									pressed && styles.wellPressed,
								]}
							>
								<Print
									url={unavailable ? null : project.thumbnail}
									unavailable={unavailable}
									space={width * (1 - MAT * 2)}
									lifted={hovered && !editing}
								/>
							</View>
							<View style={styles.caption}>
								<Text style={styles.label} numberOfLines={1}>
									{label}
								</Text>
								<Text style={styles.date} numberOfLines={1}>
									{detail}
								</Text>
							</View>
						</>
					);
				}}
			</Pressable>
			{(editing || pointerOver) && !disabled && (
				<Animated.View entering={ZoomIn.duration(160)} style={styles.delete}>
					<Pressable
						hitSlop={8}
						onPress={() => onDelete(project.id)}
						accessibilityRole="button"
						accessibilityLabel={`Delete ${label}`}
						style={(state) => {
							const { pressed, hovered } = interaction(state);
							return [
								styles.deleteButton,
								webTransition,
								(hovered || pressed) && styles.deleteButtonHovered,
							];
						}}
					>
						<Ionicons
							name="trash-outline"
							size={15}
							color={colors.textPrimary}
						/>
					</Pressable>
				</Animated.View>
			)}
		</Animated.View>
	);
}

/**
 * The project's last closed look at its own shape, fitted to `space`, like
 * a print on a mat. A placeholder until it has one.
 */
function Print({
	url,
	unavailable,
	space,
	lifted,
}: {
	url: string | null;
	unavailable: boolean;
	space: number;
	lifted: boolean;
}) {
	// Width over height, once the image is read; `false` if it can't be.
	const [aspect, setAspect] = useState<number | false | null>(null);

	useEffect(() => {
		if (!url) return;
		let current = true;
		Image.getSize(
			url,
			(width, height) => {
				if (current)
					setAspect(width > 0 && height > 0 ? width / height : false);
			},
			() => {
				if (current) setAspect(false);
			},
		);
		return () => {
			current = false;
		};
	}, [url]);

	if (!url || aspect === false) {
		return (
			<Ionicons
				name={unavailable ? "alert-circle-outline" : "image-outline"}
				size={28}
				color={colors.textTertiary}
			/>
		);
	}

	const size =
		aspect === null
			? { width: space, height: space }
			: aspect >= 1
				? { width: space, height: space / aspect }
				: { width: space * aspect, height: space };

	return (
		<View
			style={[
				styles.print,
				size,
				webTransition,
				aspect === null && styles.printLoading,
				lifted && styles.printLifted,
			]}
		>
			{/* Thumbnails are PNGs only where the canvas is see-through. */}
			{url.startsWith("data:image/png") && (
				<CheckerFill {...size} cell={Math.max(4, space / 24)} />
			)}
			<Image
				source={{ uri: url }}
				resizeMode="cover"
				style={styles.printImage}
			/>
		</View>
	);
}

/** Today's time, "Yesterday", or the date, with the year once it's past. */
function formatDate(time: number) {
	const date = new Date(time);
	const now = new Date();
	const days = Math.round(
		(startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000),
	);
	if (days === 0) {
		return `Today, ${date.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		})}`;
	}
	if (days === 1) return "Yesterday";
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
}

function startOfDay(date: Date) {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		gap: 14,
	},
	header: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
	},
	heading: {
		fontFamily: fonts.display,
		fontSize: 28,
		color: colors.textPrimary,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: GAP,
		paddingBottom: 12,
	},
	card: {
		gap: 10,
	},
	well: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radii.large,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	wellHovered: {
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceHover,
	},
	wellPressed: {
		backgroundColor: colors.surfacePressed,
		transform: [{ scale: 0.98 }],
	},
	print: {
		borderRadius: 3,
		overflow: "hidden",
		boxShadow: "0 6px 16px rgba(0, 0, 0, 0.5)",
	},
	printImage: {
		width: "100%",
		height: "100%",
		borderRadius: 3,
	},
	// Kept invisible until its shape is known, so it doesn't jump into it.
	printLoading: {
		opacity: 0,
	},
	printLifted: {
		transform: [{ translateY: -3 }, { rotate: "-1.5deg" }, { scale: 1.03 }],
		boxShadow: "0 14px 28px rgba(0, 0, 0, 0.6)",
	},
	caption: {
		gap: 2,
		paddingHorizontal: 2,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	date: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	delete: {
		position: "absolute",
		top: 8,
		right: 8,
	},
	deleteButton: {
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(20, 20, 22, 0.8)",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	deleteButtonHovered: {
		backgroundColor: colors.danger,
		borderColor: colors.danger,
	},
});
