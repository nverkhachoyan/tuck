import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, RefObject } from "react";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	type TextInputInstance,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import type { ProjectSummary } from "@/projects/projectFile";
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";
import { showAlert } from "@/ui/showAlert";
import { useTooltip } from "@/ui/Tooltip";
import {
	colorScheme,
	colors,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import { NameField } from "./NameField";
import { displayLabel, formatDate } from "./projectGrid";

const nightPrint = colorScheme === "dark";

export type ProjectCardProps = {
	project: ProjectSummary;
	width: number;
	order: number;
	editing: boolean;
	renaming: boolean;
	opening: boolean;
	disabled: boolean;
	onOpen: (id: string) => void;
	onRename: (id: string, name: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	onStartRename: () => void;
	onFinishRename: () => void;
	onContextMenu: (
		project: ProjectSummary,
		x: number,
		y: number,
		returnTo: RefObject<ViewInstance | null>,
	) => void;
};

export function ProjectCard({
	project,
	width,
	order,
	editing,
	renaming,
	opening,
	disabled,
	onOpen,
	onRename,
	onDuplicate,
	onDelete,
	onStartRename,
	onFinishRename,
	onContextMenu,
}: ProjectCardProps) {
	// Tracked around the card and its buttons together, so moving onto them
	// doesn't hide them.
	const [pointerOver, setPointerOver] = useState(false);
	const [keyboardFocused, setKeyboardFocused] = useState(false);
	const cardRootRef = useRef<ViewInstance>(null);
	const cardButtonRef = useRef<ViewInstance>(null);
	const nameInputRef = useRef<TextInputInstance>(null);

	const unavailable = project.status === "unavailable";
	const isNaming = (editing || renaming) && !unavailable;
	const showCaptionField = editing || renaming;
	const label = unavailable
		? "Unavailable project"
		: displayLabel(project.label);
	const detail = unavailable
		? "Needs a newer version of the app"
		: formatDate(project.updatedAt);

	const webFocusProps = (
		Platform.OS === "web"
			? {
					onFocus: (event: { nativeEvent: { target?: unknown } }) => {
						const target = event.nativeEvent.target;
						if (
							target instanceof HTMLElement &&
							target.matches(":focus-visible")
						) {
							setKeyboardFocused(true);
						}
					},
					onBlur: (event: { nativeEvent: { relatedTarget?: unknown } }) => {
						const root = cardRootRef.current as unknown as HTMLElement | null;
						const next = event.nativeEvent.relatedTarget;
						if (!(next instanceof Node) || !root?.contains(next)) {
							setKeyboardFocused(false);
						}
					},
				}
			: {}
	) as object;

	const webContextMenuProps = (
		Platform.OS === "web" && !disabled
			? {
					onContextMenu: (event: {
						preventDefault?: () => void;
						clientX?: number;
						clientY?: number;
					}) => {
						event.preventDefault?.();
						const node = cardButtonRef.current as unknown as HTMLElement | null;
						const rect = node?.getBoundingClientRect();
						const x =
							event.clientX && event.clientX > 0
								? event.clientX
								: (rect?.left ?? 0) + (rect?.width ?? 0) / 2;
						const y =
							event.clientY && event.clientY > 0
								? event.clientY
								: (rect?.top ?? 0) + 32;
						onContextMenu(project, x, y, cardButtonRef);
					},
				}
			: {}
	) as object;

	const lifted = pointerOver && !isNaming && !unavailable && !disabled;

	return (
		<Animated.View
			ref={cardRootRef}
			entering={FadeInDown.delay(order * 45).duration(420)}
			style={{ width }}
			onPointerEnter={(event) => {
				if (event.nativeEvent.pointerType === "mouse") setPointerOver(true);
			}}
			onPointerLeave={() => setPointerOver(false)}
			{...webFocusProps}
		>
			<Pressable
				ref={cardButtonRef}
				disabled={disabled || unavailable}
				onPress={() => {
					if (isNaming) {
						nameInputRef.current?.focus();
						return;
					}
					if (!editing) onOpen(project.id);
				}}
				onLongPress={() => {
					if (Platform.OS === "web") {
						if (pointerOver) return;
						const node = cardButtonRef.current as unknown as HTMLElement | null;
						const rect = node?.getBoundingClientRect();
						onContextMenu(
							project,
							(rect?.left ?? 0) + (rect?.width ?? 0) / 2,
							(rect?.bottom ?? 0) - 8,
							cardButtonRef,
						);
						return;
					}
					// Android shows only the first three buttons, so Cancel is
					// dropped there; back or a tap outside closes the menu instead.
					showAlert(
						label,
						detail,
						[
							...(unavailable
								? []
								: [
										{
											text: "Rename",
											onPress: onStartRename,
										},
										{
											text: "Duplicate",
											onPress: () => onDuplicate(project.id),
										},
									]),
							{
								text: "Delete",
								style: "destructive",
								onPress: () => onDelete(project.id),
							},
							{ text: "Cancel", style: "cancel" },
						],
						{ cancelable: true },
					);
				}}
				{...webContextMenuProps}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${detail}`}
				accessibilityState={{
					disabled: disabled || unavailable,
					busy: opening,
				}}
				accessibilityHint={
					isNaming ? "Edits the project name" : "Opens the project"
				}
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
									nightPrint && styles.printNight,
									webTransition,
									lifted && styles.printLifted,
									(pressed || opening) && !isNaming && styles.printPressed,
								]}
							>
								<Thumbnail
									url={unavailable ? null : project.thumbnail}
									unavailable={unavailable}
									size={width}
								/>
								{opening && (
									<View style={styles.openingOverlay}>
										<View style={styles.openingBadge}>
											<ActivityIndicator
												size="small"
												color={colors.textPrimary}
											/>
										</View>
									</View>
								)}
							</View>
							{!showCaptionField && (
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
			{showCaptionField && (
				<View style={[styles.caption, styles.editingCaption]}>
					{unavailable ? (
						<Text style={styles.label} numberOfLines={1}>
							{label}
						</Text>
					) : (
						<NameField
							inputRef={nameInputRef}
							label={label}
							disabled={disabled}
							autoFocus={renaming}
							onRename={(name) => onRename(project.id, name)}
							onDone={onFinishRename}
						/>
					)}
					<Text style={styles.date} numberOfLines={1}>
						{detail}
					</Text>
				</View>
			)}
			{(editing || pointerOver || keyboardFocused) && !disabled && (
				<Animated.View entering={ZoomIn.duration(160)} style={styles.badges}>
					{!unavailable && !isNaming && (
						<CardButton
							icon="create-outline"
							tooltipLabel="Rename"
							label={`Rename ${label}`}
							onPress={onStartRename}
						/>
					)}
					{!unavailable && (
						<CardButton
							icon="copy-outline"
							tooltipLabel="Duplicate"
							label={`Duplicate ${label}`}
							onPress={() => onDuplicate(project.id)}
						/>
					)}
					<CardButton
						icon="trash-outline"
						tooltipLabel="Delete"
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
	tooltipLabel,
	label,
	danger = false,
	onPress,
}: {
	icon: ComponentProps<typeof Ionicons>["name"];
	tooltipLabel: string;
	label: string;
	danger?: boolean;
	onPress: () => void;
}) {
	const { anchor, tooltip } = useTooltip(tooltipLabel);
	return (
		<>
			<Pressable
				{...anchor}
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
				{(state) => {
					const { pressed, hovered } = interaction(state);
					const activeDanger = danger && (hovered || pressed);
					return (
						<Ionicons
							name={icon}
							size={15}
							color={activeDanger ? colors.onPrimary : colors.textPrimary}
						/>
					);
				}}
			</Pressable>
			{tooltip}
		</>
	);
}

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
				alt=""
				accessible={false}
				resizeMode="cover"
				onError={() => setFailed(true)}
				style={StyleSheet.absoluteFill}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	card: {
		gap: space.xs,
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
	printNight: {
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	printLifted: {
		transform: [{ translateY: -2 }],
		boxShadow: `0 2px 3px ${colors.shadow}, 0 12px 22px -6px ${colors.shadow}`,
	},
	printPressed: {
		opacity: 0.8,
	},
	openingOverlay: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
	},
	openingBadge: {
		width: 34,
		height: 34,
		borderRadius: 17,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
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
