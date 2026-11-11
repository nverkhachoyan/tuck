import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	Platform,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import type { ProjectSummary } from "@/projects/projectFile";
import { interaction } from "@/ui/interaction";
import { Popover } from "@/ui/Popover";
import { colors, radii, space, typography, webTransition } from "@/ui/theme";
import { ProjectCard } from "./ProjectCard";
import {
	displayLabel,
	GRID_GAP,
	GRID_PADDING,
	gridLayout,
	HOME_MAX_WIDTH,
} from "./projectGrid";

export { HOME_MAX_WIDTH } from "./projectGrid";

// Cards after this many appear together, so a long list doesn't trickle in.
const STAGGERED = 8;

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
	footer: {
		width: "100%",
		paddingTop: space.sm,
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
