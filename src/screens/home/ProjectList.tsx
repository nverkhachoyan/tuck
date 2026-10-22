import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { useRef, useState } from "react";
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
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";
import { showAlert } from "@/ui/showAlert";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";

// The home screen's content column, so a wide browser window doesn't
// stretch it, and its side padding.
export const HOME_MAX_WIDTH = 760;
const PADDING = 16;
const GAP = 16;
const MIN_CARD_WIDTH = 150;
const MAX_COLUMNS = 5;
// Cards after this many appear together, so a long list doesn't trickle in.
const STAGGERED = 8;

type ProjectListProps = {
	projects: ProjectSummary[];
	editing: boolean;
	disabled: boolean;
	onOpen: (id: string) => void;
	onRename: (id: string, name: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	onStartEditing: () => void;
	// Under the last row, the width of the grid.
	footer?: ReactNode;
};

/**
 * The saved projects as prints on the table, each with its name and when it
 * was last changed, which open them. A long press offers Duplicate, Rename,
 * and Delete; with a mouse, hovering shows those buttons. `editing` (home's
 * Edit) puts each name in a field to rename it.
 */
export function ProjectList({
	projects,
	editing,
	disabled,
	onOpen,
	onRename,
	onDuplicate,
	onDelete,
	onStartEditing,
	footer,
}: ProjectListProps) {
	const [width, setWidth] = useState(0);
	const inner = Math.min(width, HOME_MAX_WIDTH) - PADDING * 2;
	const columns = Math.max(
		1,
		Math.min(MAX_COLUMNS, Math.floor((inner + GAP) / (MIN_CARD_WIDTH + GAP))),
	);
	const cardWidth = (inner - GAP * (columns - 1)) / columns;

	return (
		<ScrollView
			style={styles.scroll}
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
						onStartEditing={onStartEditing}
					/>
				))}
			{width > 0 && footer && <View style={styles.footer}>{footer}</View>}
		</ScrollView>
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
						<>
							<View
								style={[
									styles.print,
									{ height: width },
									webTransition,
									pressed && styles.printPressed,
								]}
							>
								<Thumbnail
									url={unavailable ? null : project.thumbnail}
									unavailable={unavailable}
									size={width}
								/>
							</View>
							{!editing && (
								<View style={styles.caption}>
									<Text style={styles.label} numberOfLines={1}>
										{label}
									</Text>
									<Text style={styles.date} numberOfLines={1}>
										{detail}
									</Text>
								</View>
							)}
						</>
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
	scroll: {
		flex: 1,
	},
	grid: {
		width: "100%",
		maxWidth: HOME_MAX_WIDTH,
		alignSelf: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		columnGap: GAP,
		rowGap: 20,
		padding: PADDING,
	},
	card: {
		gap: space.xs,
	},
	footer: {
		width: "100%",
		paddingTop: space.sm,
	},
	// A print on the table, with the canvas's shadows (see `EditorScene`).
	print: {
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: 3,
		backgroundColor: colors.surface,
		boxShadow: `0 1px 1.5px ${colors.shadow}, 0 8px 18px -6px ${colors.shadow}`,
	},
	printPressed: {
		opacity: 0.8,
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
		backgroundColor: colors.surface,
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
