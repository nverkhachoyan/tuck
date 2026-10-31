import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	type LayoutChangeEvent,
	Platform,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	Text,
	TextInput,
	type TextInputInstance,
	type TextStyle,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import {
	NAME_MAX_LENGTH,
	type ProjectSummary,
	projectName,
} from "@/projects/projectFile";
import { CheckerFill } from "@/ui/CheckerFill";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { showAlert } from "@/ui/showAlert";
import { useTooltip } from "@/ui/Tooltip";
import {
	colorScheme,
	colors,
	radii,
	space,
	typography,
	webTransition,
} from "@/ui/theme";
import {
	displayLabel,
	formatDate,
	GRID_GAP,
	GRID_PADDING,
	gridLayout,
	HOME_MAX_WIDTH,
} from "./projectGrid";

export { HOME_MAX_WIDTH } from "./projectGrid";

// Cards after this many appear together, so a long list doesn't trickle in.
const STAGGERED = 8;
const nightPrint = colorScheme === "dark";

type ContextMenuState = {
	project: ProjectSummary;
	x: number;
	y: number;
	returnTo: RefObject<ViewInstance | null>;
};

type ProjectListProps = {
	projects: ProjectSummary[];
	editing: boolean;
	disabled: boolean;
	openingProjectId: string | null;
	scrollTopKey: number;
	bottomInset?: number;
	onOpen: (id: string) => void;
	onRename: (id: string, name: string) => void;
	onDuplicate: (id: string) => void;
	onDelete: (id: string) => void;
	// Under the last row, the width of the grid.
	footer?: ReactNode;
};

/**
 * The saved projects as prints on the table, each with its name and when it
 * was last changed, which open them.
 * - Long-pressing (or right-clicking on web) offers Rename, Duplicate, and Delete.
 * - Hovering with a mouse or tabbing with a keyboard reveals corner buttons on the print.
 * - Choosing Rename focuses that card's name inline; `editing` (Home's Edit) opens every card's name field.
 */
export function ProjectList({
	projects,
	editing,
	disabled,
	openingProjectId,
	scrollTopKey,
	bottomInset = 0,
	onOpen,
	onRename,
	onDuplicate,
	onDelete,
	footer,
}: ProjectListProps) {
	const scrollRef = useRef<ScrollViewInstance>(null);
	const [width, setWidth] = useState(0);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [menu, setMenu] = useState<ContextMenuState | null>(null);
	const menuAnchorRef = useRef<ViewInstance | null>(null);
	const skipMenuRestoreRef = useRef(false);

	useEffect(() => {
		if (scrollTopKey > 0) {
			scrollRef.current?.scrollTo({ y: 0, animated: true });
		}
	}, [scrollTopKey]);

	useEffect(() => {
		if (editing || disabled) setRenamingId(null);
		if (disabled) setMenu(null);
	}, [editing, disabled]);

	const { cardWidth } = gridLayout(width);

	const openContextMenu = (
		project: ProjectSummary,
		x: number,
		y: number,
		returnTo: RefObject<ViewInstance | null>,
	) => {
		menuAnchorRef.current = {
			getBoundingClientRect: () => ({
				left: x,
				top: y,
				width: 0,
				height: 0,
			}),
		} as unknown as ViewInstance;
		skipMenuRestoreRef.current = false;
		setMenu({ project, x, y, returnTo });
	};

	const closeContextMenu = () => setMenu(null);

	return (
		<>
			<ScrollView
				ref={scrollRef}
				style={styles.scroll}
				contentContainerStyle={
					bottomInset > 0 ? { paddingBottom: bottomInset } : undefined
				}
				showsVerticalScrollIndicator={false}
				// So a name being typed stays above the keyboard, and a tap on
				// another card's field moves straight to it.
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
			>
				{/* Measured inside ScrollView so web scrollbar width never wraps a row. */}
				<View
					style={styles.grid}
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
								renaming={renamingId === project.id}
								opening={openingProjectId === project.id}
								disabled={disabled}
								onOpen={onOpen}
								onRename={onRename}
								onDuplicate={onDuplicate}
								onDelete={onDelete}
								onStartRename={() => setRenamingId(project.id)}
								onFinishRename={() =>
									setRenamingId((current) =>
										current === project.id ? null : current,
									)
								}
								onContextMenu={openContextMenu}
							/>
						))}
					{width > 0 && footer && <View style={styles.footer}>{footer}</View>}
				</View>
			</ScrollView>
			{Platform.OS === "web" && menu && (
				<Popover
					anchor={menuAnchorRef}
					open={true}
					onClose={closeContextMenu}
					label={`${
						menu.project.status === "unavailable"
							? "Unavailable project"
							: displayLabel(menu.project.label)
					} actions`}
					restoreFocus={() => {
						if (skipMenuRestoreRef.current) {
							skipMenuRestoreRef.current = false;
							return;
						}
						(menu.returnTo.current as unknown as HTMLElement | null)?.focus();
					}}
				>
					<View style={styles.menuList}>
						{menu.project.status !== "unavailable" && (
							<>
								<MenuRow
									icon="create-outline"
									label="Rename"
									onPress={() => {
										const id = menu.project.id;
										skipMenuRestoreRef.current = true;
										closeContextMenu();
										setRenamingId(id);
									}}
								/>
								<MenuRow
									icon="copy-outline"
									label="Duplicate"
									onPress={() => {
										const id = menu.project.id;
										closeContextMenu();
										onDuplicate(id);
									}}
								/>
							</>
						)}
						<MenuRow
							icon="trash-outline"
							label="Delete"
							danger
							onPress={() => {
								const id = menu.project.id;
								const cardNode = menu.returnTo
									.current as unknown as HTMLElement | null;
								skipMenuRestoreRef.current = true;
								cardNode?.focus();
								closeContextMenu();
								onDelete(id);
							}}
						/>
					</View>
				</Popover>
			)}
		</>
	);
}

function ProjectCard({
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
}: {
	project: ProjectSummary;
	width: number;
	order: number;
	editing: boolean;
	renaming: boolean;
	opening: boolean;
	onStartRename: () => void;
	onFinishRename: () => void;
	onContextMenu: (
		project: ProjectSummary,
		x: number,
		y: number,
		returnTo: RefObject<ViewInstance | null>,
	) => void;
} & Pick<
	ProjectListProps,
	"disabled" | "onOpen" | "onRename" | "onDuplicate" | "onDelete"
>) {
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
					showAlert(label, detail, [
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
					]);
				}}
				{...webContextMenuProps}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${detail}`}
				accessibilityState={{
					disabled: disabled || unavailable,
					busy: opening || undefined,
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

function MenuRow({
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
	const ink = danger ? colors.danger : colors.textPrimary;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={(state) => {
				const { pressed, hovered } = interaction(state);
				return [
					styles.menuRow,
					webTransition,
					hovered &&
						(danger ? styles.menuRowDangerHovered : styles.menuRowHovered),
					pressed && styles.menuRowPressed,
				];
			}}
		>
			<Ionicons name={icon} size={17} color={ink} />
			<Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * Leaving the field, or Return, renames it, and Escape puts the name back.
 * A blank name lists the project by its text again.
 */
function NameField({
	inputRef,
	label,
	disabled,
	autoFocus = false,
	onRename,
	onDone,
}: {
	inputRef: RefObject<TextInputInstance | null>;
	label: string;
	disabled: boolean;
	autoFocus?: boolean;
	onRename: (name: string) => void;
	onDone: () => void;
}) {
	// What's typed, while the field has focus.
	const [draft, setDraft] = useState<string | null>(null);
	const [focused, setFocused] = useState(false);
	const draftRef = useRef<string | null>(null);
	const cancelled = useRef(false);
	const labelRef = useRef(label);
	labelRef.current = label;
	const onRenameRef = useRef(onRename);
	onRenameRef.current = onRename;

	useEffect(() => {
		if (!autoFocus) return;
		const frame = requestAnimationFrame(() => {
			const node = inputRef.current;
			if (!node) return;
			node.focus();
			if (Platform.OS === "web") {
				(node as unknown as HTMLInputElement).setSelectionRange?.(
					0,
					labelRef.current.length,
				);
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [autoFocus, inputRef]);

	// Commits an unblurred edit if Home's Done unmounts the field directly.
	useEffect(() => {
		return () => {
			const typed = draftRef.current;
			draftRef.current = null;
			if (cancelled.current) return;
			if (typed !== null && projectName(typed) !== labelRef.current) {
				onRenameRef.current(typed);
			}
		};
	}, []);

	const finish = () => {
		const typed = draftRef.current;
		draftRef.current = null;
		setDraft(null);
		setFocused(false);
		onDone();
		if (cancelled.current) {
			cancelled.current = false;
			return;
		}
		if (typed !== null && projectName(typed) !== label) onRename(typed);
	};

	return (
		<TextInput
			ref={inputRef}
			value={draft ?? label}
			editable={!disabled}
			hitSlop={8}
			onFocus={() => {
				setFocused(true);
				draftRef.current = label;
				setDraft(label);
				if (Platform.OS !== "web") {
					inputRef.current?.setSelection(0, label.length);
				} else {
					(
						inputRef.current as unknown as HTMLInputElement | null
					)?.setSelectionRange?.(0, label.length);
				}
			}}
			onChangeText={(next) => {
				draftRef.current = next;
				setDraft(next);
			}}
			onSubmitEditing={() => inputRef.current?.blur()}
			onBlur={finish}
			onKeyPress={(event) => {
				if (event.nativeEvent.key !== "Escape") return;
				cancelled.current = true;
				inputRef.current?.blur();
			}}
			selectTextOnFocus
			maxLength={NAME_MAX_LENGTH}
			returnKeyType="done"
			autoCorrect={false}
			accessibilityLabel={`Project name, ${label}`}
			style={[
				styles.label,
				styles.nameField,
				focused && styles.nameFieldFocused,
				fieldFocusStyle,
			]}
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
	scroll: {
		flex: 1,
	},
	grid: {
		width: "100%",
		maxWidth: HOME_MAX_WIDTH,
		alignSelf: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		columnGap: GRID_GAP,
		rowGap: 20,
		padding: GRID_PADDING,
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
	nameField: {
		height: 30,
		marginHorizontal: -2,
		paddingHorizontal: 8,
		borderRadius: radii.small,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface,
	},
	nameFieldFocused: {
		borderWidth: 2,
		borderColor: colors.textPrimary,
		paddingHorizontal: 7,
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
	menuList: {
		minWidth: 152,
		gap: 2,
	},
	menuRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		minHeight: 36,
		paddingHorizontal: space.sm,
		paddingVertical: 6,
		borderRadius: radii.small,
	},
	menuRowHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	menuRowDangerHovered: {
		backgroundColor: colors.dangerSoft,
	},
	menuRowPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	menuLabel: {
		...typography.labelStrong,
		color: colors.textPrimary,
	},
	menuLabelDanger: {
		color: colors.danger,
	},
});
