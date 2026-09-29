import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useRef, useState } from "react";
import {
	Image,
	type LayoutChangeEvent,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	type TextStyle,
	View,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import {
	NAME_MAX_LENGTH,
	type ProjectSummary,
	projectName,
} from "@/projects/projectFile";
import { colors, fonts, radii, typography, webTransition } from "@/theme";
import { CheckerFill } from "@/ui/CheckerFill";
import { gradientBackground } from "@/ui/gradient";
import { interaction } from "@/ui/interaction";
import { showAlert } from "@/ui/showAlert";
import { TextButton } from "@/ui/TextButton";

const GAP = 4;
const MIN_CARD_WIDTH = 100;
const MAX_COLUMNS = 6;
// Cards after this many appear together, so a long list doesn't trickle in.
const STAGGERED = 8;

type ProjectListProps = {
	projects: ProjectSummary[];
	disabled: boolean;
	onOpen: (id: string) => void;
	onRename: (id: string, name: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
};

/**
 * The saved projects as a grid of thumbnails, like a photo library's, which
 * open them. A long press offers Duplicate, Rename, and Delete; with a
 * mouse, hovering shows the name and those buttons. Edit puts each name in
 * a field under its thumbnail to rename it.
 */
export function ProjectList({
	projects,
	disabled,
	onOpen,
	onRename,
	onDuplicate,
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
				// So a name being typed stays above the keyboard, and a tap on
				// another card's field moves straight to it.
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
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
							onRename={onRename}
							onDuplicate={onDuplicate}
							onDelete={onDelete}
							onStartEditing={() => setEditing(true)}
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
	onRename,
	onDuplicate,
	onDelete,
	onStartEditing,
}: {
	project: ProjectSummary;
	width: number;
	order: number;
} & Pick<
	ProjectListProps,
	"disabled" | "onOpen" | "onRename" | "onDuplicate" | "onDelete"
> & {
		editing: boolean;
		onStartEditing: () => void;
	}) {
	// Tracked around the card and its buttons together, so moving onto them
	// doesn't hide them.
	const [pointerOver, setPointerOver] = useState(false);
	const unavailable = project.status === "unavailable";
	const label = unavailable
		? "Unavailable project"
		: displayLabel(project.label);
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
				onLongPress={() =>
					showAlert(label, detail, [
						...(unavailable
							? []
							: [
									{
										text: "Duplicate",
										onPress: () => onDuplicate(project.id),
									},
									{ text: "Rename", onPress: onStartEditing },
								]),
						{
							text: "Delete",
							style: "destructive",
							onPress: () => onDelete(project.id),
						},
						{ text: "Cancel", style: "cancel" },
					])
				}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${detail}`}
				accessibilityHint={editing ? undefined : "Opens the project"}
				style={styles.card}
			>
				{(state) => {
					const { pressed } = interaction(state);
					return (
						<View
							style={[
								styles.thumbnail,
								{ height: width },
								webTransition,
								pressed && styles.thumbnailPressed,
							]}
						>
							<Thumbnail
								url={unavailable ? null : project.thumbnail}
								unavailable={unavailable}
								size={width}
							/>
							{pointerOver && !editing && (
								<View style={styles.hoverCaption}>
									<Text style={styles.hoverLabel} numberOfLines={1}>
										{label}
									</Text>
									<Text style={styles.hoverDate} numberOfLines={1}>
										{detail}
									</Text>
								</View>
							)}
						</View>
					);
				}}
			</Pressable>
			{/* Beside the card rather than in it, so a press on the field is the
			    field's alone. */}
			{editing && (
				<View style={[styles.caption, styles.editingCaption]}>
					{unavailable ? (
						<Text style={styles.label} numberOfLines={1}>
							{label}
						</Text>
					) : (
						<NameField
							label={label}
							disabled={disabled}
							onRename={(name) => onRename(project.id, name)}
						/>
					)}
					<Text style={styles.date} numberOfLines={1}>
						{detail}
					</Text>
				</View>
			)}
			{(editing || pointerOver) && !disabled && (
				<Animated.View entering={ZoomIn.duration(160)} style={styles.badges}>
					{!unavailable && (
						<CardButton
							icon="copy-outline"
							label={`Duplicate ${label}`}
							onPress={() => onDuplicate(project.id)}
						/>
					)}
					<CardButton
						icon="trash-outline"
						label={`Delete ${label}`}
						danger
						onPress={() => onDelete(project.id)}
					/>
				</Animated.View>
			)}
		</Animated.View>
	);
}

/** A small round button over a card's corner. */
function CardButton({
	icon,
	label,
	danger = false,
	onPress,
}: {
	icon: ComponentProps<typeof Ionicons>["name"];
	label: string;
	danger?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			hitSlop={6}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.cardButton,
					webTransition,
					(hovered || pressed) &&
						(danger ? styles.cardButtonDanger : styles.cardButtonHovered),
				];
			}}
		>
			<Ionicons name={icon} size={15} color={colors.textPrimary} />
		</Pressable>
	);
}

/**
 * A project's name, to type a new one over. Leaving the field, or Return,
 * renames it, and Escape puts the name back. A blank name lists the project
 * by its text again.
 */
function NameField({
	label,
	disabled,
	onRename,
}: {
	label: string;
	disabled: boolean;
	onRename: (name: string) => void;
}) {
	const input = useRef<TextInput>(null);
	// What's typed, while the field has focus.
	const [draft, setDraft] = useState<string | null>(null);
	const cancelled = useRef(false);
	const finish = () => {
		const typed = draft;
		setDraft(null);
		if (cancelled.current) {
			cancelled.current = false;
			return;
		}
		if (typed !== null && projectName(typed) !== label) onRename(typed);
	};
	return (
		<TextInput
			ref={input}
			value={draft ?? label}
			editable={!disabled}
			onFocus={() => setDraft(label)}
			onChangeText={setDraft}
			onBlur={finish}
			onKeyPress={(event) => {
				if (event.nativeEvent.key !== "Escape") return;
				cancelled.current = true;
				input.current?.blur();
			}}
			selectTextOnFocus
			maxLength={NAME_MAX_LENGTH}
			returnKeyType="done"
			autoCorrect={false}
			accessibilityLabel="Project name"
			style={[styles.label, styles.nameField, fieldFocusStyle]}
		/>
	);
}

// Browsers ring a focused field in their own blue; the field's own border
// shows focus instead.
const fieldFocusStyle =
	Platform.OS === "web"
		? ({ outlineStyle: "none" } as unknown as TextStyle)
		: null;

/**
 * The project's last closed look, filling a square as a photo library's
 * thumbnails do. A placeholder until it has one, or if it can't be read.
 */
function Thumbnail({
	url,
	unavailable,
	size,
}: {
	url: string | null;
	unavailable: boolean;
	size: number;
}) {
	const [failed, setFailed] = useState(false);
	if (!url || failed) {
		return (
			<Ionicons
				name={unavailable ? "alert-circle-outline" : "image-outline"}
				size={28}
				color={colors.textTertiary}
			/>
		);
	}
	return (
		<>
			{/* Thumbnails are PNGs only where the canvas is see-through. */}
			{url.startsWith("data:image/png") && (
				<CheckerFill width={size} height={size} cell={Math.max(4, size / 24)} />
			)}
			<Image
				source={{ uri: url }}
				resizeMode="cover"
				onError={() => setFailed(true)}
				style={StyleSheet.absoluteFill}
			/>
		</>
	);
}

/**
 * A project listed by its text shows it in sentence case: meme text is
 * usually all capitals, which shouts in a list.
 */
function displayLabel(label: string) {
	if (label !== label.toUpperCase() || label === label.toLowerCase()) {
		return label;
	}
	return label.charAt(0) + label.slice(1).toLowerCase();
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
		gap: 6,
	},
	thumbnail: {
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: radii.small,
		borderCurve: "continuous",
		backgroundColor: colors.surface,
	},
	thumbnailPressed: {
		opacity: 0.8,
	},
	// Over the thumbnail's foot, on a shade that keeps it legible on any
	// image.
	hoverCaption: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 8,
		paddingTop: 20,
		paddingBottom: 6,
		...gradientBackground(
			"linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.75))",
		),
	},
	hoverLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	hoverDate: {
		...typography.caption,
		color: colors.textSecondary,
	},
	caption: {
		gap: 2,
		paddingHorizontal: 2,
	},
	label: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	date: {
		...typography.caption,
		color: colors.textSecondary,
	},
	// Where the caption sits in the card while it's out of it (see
	// `ProjectCard`), with room for the field's padding.
	editingCaption: {
		marginTop: 6,
	},
	nameField: {
		height: 30,
		marginHorizontal: -2,
		paddingHorizontal: 8,
		borderRadius: radii.small,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	badges: {
		position: "absolute",
		top: 8,
		right: 8,
		flexDirection: "row",
		gap: 6,
	},
	cardButton: {
		width: 30,
		height: 30,
		borderRadius: 15,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(20, 20, 22, 0.8)",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	cardButtonHovered: {
		backgroundColor: colors.surfacePressed,
	},
	cardButtonDanger: {
		backgroundColor: colors.danger,
		borderColor: colors.danger,
	},
});
