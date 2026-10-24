import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RingChoice } from "@/ui/RingChoice";
import { colors } from "@/ui/theme";
import {
	BarButton,
	BarGroup,
	BarSections,
	OptionSegments,
} from "../../shell/ContextBar";
import { ToolButton, ToolRow } from "../../shell/ToolButton";
import {
	SIZE_DOTS,
	SizeChip,
	SizeChoices,
	SizeDot,
	ToolChoices,
	ToolOption,
	ToolOptions,
} from "../../shell/ToolOptions";
import type { CutOutSettings, CutOutTool } from "./cutOutSettings";

/**
 * Cut out's tools, in place of the toolbar while cutting an image out:
 * Subjects cuts out every subject again, Pick the one under a tap, and Keep
 * and Erase paint the cut by hand, with their size in a tray over the
 * canvas. Tapping the brush in use opens its size too. Subjects and Pick
 * show only where this device can find subjects (`onFindAll`), and spin
 * while they're finding one (`finding`). Once there's a cut, Invert keeps
 * what it removes instead and removes what it keeps (`onInvert`), and
 * Redact hides what it keeps under a redaction (`onRedact`): inverted
 * first, that blurs only the background. Each spins while it works.
 */
export function CutOutPanel({
	settings,
	tool,
	finding,
	optionsOpen,
	onChange,
	onToggleOptions,
	onFindAll,
	inverting,
	onInvert,
	redacting,
	onRedact,
}: {
	settings: CutOutSettings;
	tool: CutOutTool;
	finding: "all" | "one" | null;
	optionsOpen: boolean;
	onChange: (settings: CutOutSettings) => void;
	onToggleOptions: () => void;
	onFindAll?: () => void;
	inverting: boolean;
	onInvert?: () => void;
	redacting: boolean;
	onRedact?: () => void;
}) {
	const pickTool = (choice: CutOutTool) => {
		if (choice === tool && choice !== "pick") onToggleOptions();
		else onChange({ ...settings, tool: choice });
	};
	const brush = tool !== "pick";
	return (
		<ToolRow>
			{onFindAll && (
				<ToolButton
					label="Subjects"
					icon="auto-fix"
					busy={finding === "all"}
					onPress={onFindAll}
				/>
			)}
			{onFindAll && (
				<ToolButton
					label="Pick"
					icon="gesture-tap"
					selected={tool === "pick"}
					busy={finding === "one"}
					onPress={() => pickTool("pick")}
				/>
			)}
			<ToolButton
				label="Keep"
				icon="brush"
				selected={tool === "keep"}
				onPress={() => pickTool("keep")}
			/>
			<ToolButton
				label="Erase"
				icon="eraser"
				selected={tool === "erase"}
				onPress={() => pickTool("erase")}
			/>
			{brush && (
				<ToolButton
					label="Size"
					icon="circle-medium"
					glyph={
						<SizeDot
							size={
								SIZE_DOTS[
									tool === "keep" ? settings.keepSize : settings.eraseSize
								]
							}
							color={tool === "keep" ? colors.textPrimary : null}
						/>
					}
					open={optionsOpen}
					onPress={onToggleOptions}
				/>
			)}
			{onInvert && (
				<ToolButton
					label="Invert"
					icon="select-inverse"
					busy={inverting}
					onPress={onInvert}
				/>
			)}
			{onRedact && (
				<ToolButton
					label="Redact"
					icon="blur"
					busy={redacting}
					onPress={onRedact}
				/>
			)}
		</ToolRow>
	);
}

const BRUSH_EDGES = [
	{ soft: true, title: "Soft", icon: "blur-radial" },
	{ soft: false, title: "Hard", icon: "circle" },
] as const;

/**
 * Cut out's options in the wide editor's header: Pick, Keep, and Erase, then
 * the brushes' size, then Subjects, Invert, and Redact. Soft and Hard sit in
 * the size chip. Choosing the sub-tool already in use leaves it, since the
 * options stay in view. The canvas wash is unchanged.
 */
export function CutOutBar({
	settings,
	tool,
	finding,
	onChange,
	onFindAll,
	inverting,
	onInvert,
	redacting,
	onRedact,
}: {
	settings: CutOutSettings;
	tool: CutOutTool;
	finding: "all" | "one" | null;
	onChange: (settings: CutOutSettings) => void;
	onFindAll?: () => void;
	inverting: boolean;
	onInvert?: () => void;
	redacting: boolean;
	onRedact?: () => void;
}) {
	const options = [
		...(onFindAll
			? [
					{
						title: "Pick",
						tool: "pick" as const,
						icon: "gesture-tap" as const,
						busy: finding === "one",
					},
				]
			: []),
		{
			title: "Keep",
			tool: "keep" as const,
			icon: "brush" as const,
			busy: false,
		},
		{
			title: "Erase",
			tool: "erase" as const,
			icon: "eraser" as const,
			busy: false,
		},
	];
	const selected = Math.max(
		0,
		options.findIndex((option) => option.tool === tool),
	);
	const brush = tool === "keep" || tool === "erase";
	return (
		<BarSections>
			<BarGroup>
				<OptionSegments
					label="Cut out tool"
					options={options}
					selected={selected}
					onSelect={(index) => {
						const next = options[index]?.tool;
						if (!next || next === tool) return;
						onChange({ ...settings, tool: next });
					}}
				/>
			</BarGroup>
			{brush && (
				<BarGroup>
					<SizeChip
						index={tool === "keep" ? settings.keepSize : settings.eraseSize}
						color={tool === "keep" ? colors.textPrimary : null}
						onPick={(index) =>
							onChange(
								tool === "keep"
									? { ...settings, keepSize: index }
									: { ...settings, eraseSize: index },
							)
						}
					>
						<OptionSegments
							label="Edge"
							options={BRUSH_EDGES.map(({ title, icon }) => ({ title, icon }))}
							selected={BRUSH_EDGES.findIndex(
								(edge) => edge.soft === settings.soft,
							)}
							onSelect={(index) => {
								const edge = BRUSH_EDGES[index];
								if (!edge || edge.soft === settings.soft) return;
								onChange({ ...settings, soft: edge.soft });
							}}
						/>
					</SizeChip>
				</BarGroup>
			)}
			{(onFindAll || onInvert || onRedact) && (
				<BarGroup>
					{onFindAll && (
						<BarButton
							label="Subjects"
							icon="auto-fix"
							busy={finding === "all"}
							onPress={onFindAll}
						/>
					)}
					{onInvert && (
						<BarButton
							label="Invert"
							icon="select-inverse"
							busy={inverting}
							onPress={onInvert}
						/>
					)}
					{onRedact && (
						<BarButton
							label="Redact"
							icon="blur"
							busy={redacting}
							onPress={onRedact}
						/>
					)}
				</BarGroup>
			)}
		</BarSections>
	);
}

/**
 * The size of the brush in use, and whether both brushes' edges are soft,
 * in a tray above the dock.
 */
export function CutOutOptions({
	settings,
	tool,
	bottomInset,
	onChange,
	onClose,
}: {
	settings: CutOutSettings;
	tool: "keep" | "erase";
	bottomInset: number;
	onChange: (settings: CutOutSettings) => void;
	onClose: () => void;
}) {
	const keep = tool === "keep";
	return (
		<ToolOptions
			closeLabel="Close brush options"
			bottomInset={bottomInset}
			onClose={onClose}
			dismissOnOutsidePress={false}
		>
			<ToolOption label="Size">
				<SizeChoices
					index={keep ? settings.keepSize : settings.eraseSize}
					color={keep ? colors.textPrimary : null}
					onPick={(index) =>
						onChange(
							keep
								? { ...settings, keepSize: index }
								: { ...settings, eraseSize: index },
						)
					}
				/>
			</ToolOption>
			<ToolOption label="Edge">
				<ToolChoices>
					{[true, false].map((soft) => (
						<RingChoice
							key={String(soft)}
							variant="highlight"
							label={soft ? "Soft edge" : "Hard edge"}
							selected={settings.soft === soft}
							onPress={() => onChange({ ...settings, soft })}
						>
							{(ink) => (
								<MaterialCommunityIcons
									name={soft ? "blur-radial" : "circle"}
									size={22}
									color={ink}
								/>
							)}
						</RingChoice>
					))}
				</ToolChoices>
			</ToolOption>
		</ToolOptions>
	);
}
