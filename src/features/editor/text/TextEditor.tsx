import { useEffect, useState } from "react";
import {
	BackHandler,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	TextInput,
	type TextStyle,
	View,
} from "react-native";
import { TEXT_FONTS } from "@/layers/fonts";
import type { TextAlign, TextLayerStyle } from "@/model/document";
import { colors, HEADER_HEIGHT, webTransition } from "@/theme";
import { Button } from "@/ui/Button";
import { FrostedBackdrop } from "@/ui/GlassView";
import { interaction } from "@/ui/interaction";
import { useTooltip } from "@/ui/Tooltip";

const NEXT_ALIGN: Record<TextAlign, TextAlign> = {
	center: "left",
	left: "right",
	right: "center",
};

type TextEditorProps = {
	initialText: string;
	// Of the style, only the alignment can change here.
	layerStyle: TextLayerStyle;
	// Called with the final text, which may be empty.
	onDone: (text: string, align: TextAlign) => void;
};

/**
 * Full-screen text entry over the dimmed canvas. The text is shown upright
 * and large rather than at the layer's position, size, and rotation: Skia
 * draws the real result once editing ends, so this only has to be pleasant
 * to type into, not pixel-identical.
 */
export function TextEditor({
	initialText,
	layerStyle,
	onDone,
}: TextEditorProps) {
	const { font, color, outlineColor, backgroundColor } = layerStyle;
	const [text, setText] = useState(initialText);
	const [align, setAlign] = useState(layerStyle.align);
	const done = () => onDone(text, align);
	// Three bars alone read as a menu, so on web, hovering says what they do.
	const alignLabel = `Text alignment: ${align}`;
	const { anchor, tooltip } = useTooltip(alignLabel);
	const outlineStyle =
		outlineColor === null
			? undefined
			: Platform.select<TextStyle>({
					// React Native Web deprecated the split textShadow* props in
					// favor of the CSS shorthand; native still uses the split props.
					web: {
						textShadow: `0px 0px 4px ${outlineColor}`,
					} as unknown as TextStyle,
					default: {
						textShadowColor: outlineColor,
						textShadowOffset: { width: 0, height: 0 },
						textShadowRadius: 4,
					},
				});

	// Android's back button finishes editing rather than leaving the editor.
	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				onDone(text, align);
				return true;
			},
		);
		return () => subscription.remove();
	}, [onDone, text, align]);

	return (
		<View style={StyleSheet.absoluteFill}>
			{/* Below the toolbar, so the header it covers can't blur into view. */}
			<FrostedBackdrop style={styles.backdrop} />
			{/* The input is the only thing on screen the keyboard could cover. */}
			<KeyboardAvoidingView behavior="padding" style={styles.flex}>
				<View style={styles.toolbar}>
					<Pressable
						{...anchor}
						hitSlop={4}
						onPress={() => setAlign(NEXT_ALIGN[align])}
						accessibilityRole="button"
						accessibilityLabel={alignLabel}
						style={(state) => {
							const { pressed, hovered } = interaction(state);
							return [
								styles.alignButton,
								webTransition,
								hovered && styles.alignButtonHovered,
								pressed && styles.alignButtonPressed,
							];
						}}
					>
						<AlignIcon align={align} />
					</Pressable>
					{tooltip}
					<Button label="Done" variant="primary" size="small" onPress={done} />
				</View>

				<View style={styles.inputArea}>
					{/* Tapping anywhere outside the text also finishes. Behind the
					    input, not around it: on web, clicks on the input would bubble. */}
					<Pressable style={StyleSheet.absoluteFill} onPress={done} />
					<TextInput
						value={text}
						onChangeText={setText}
						autoFocus
						multiline
						placeholder="Type something"
						placeholderTextColor={colors.textSecondary}
						style={[
							styles.input,
							{ fontFamily: TEXT_FONTS[font].family, color, textAlign: align },
							backgroundColor !== null && [styles.box, { backgroundColor }],
							outlineStyle,
						]}
					/>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
}

/** Three bars aligned the way the text is. */
function AlignIcon({ align }: { align: TextAlign }) {
	const alignItems =
		align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
	return (
		<View style={[styles.alignIcon, { alignItems }]}>
			<View style={[styles.alignBar, { width: 22 }]} />
			<View style={[styles.alignBar, { width: 14 }]} />
			<View style={[styles.alignBar, { width: 18 }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		top: HEADER_HEIGHT,
	},
	flex: {
		flex: 1,
	},
	// Opaque, so the screen header underneath doesn't show through.
	toolbar: {
		height: HEADER_HEIGHT,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		backgroundColor: colors.background,
	},
	// A halo around the icon, overhanging so the bar keeps its spacing.
	alignButton: {
		width: 40,
		height: 40,
		margin: -9,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	alignButtonHovered: {
		backgroundColor: colors.hoverOverlay,
	},
	alignButtonPressed: {
		backgroundColor: colors.pressedOverlay,
	},
	inputArea: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	// The layer's own font (set inline), so the text doesn't change face when
	// editing ends. No fontWeight: Android drops a custom font asked for in a
	// weight it wasn't registered with.
	input: {
		fontSize: 34,
		// Native's default, but React Native Web leaves the textarea static,
		// which CSS paints under the absolutely positioned backdrop.
		position: "relative",
		// Browsers ring a focused input; here the caret already shows focus.
		// React Native's types lack "none", which only web understands.
		...Platform.select({
			web: { outlineStyle: "none" } as unknown as TextStyle,
		}),
	},
	box: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
	},
	alignIcon: {
		width: 22,
		gap: 4,
	},
	alignBar: {
		height: 2.5,
		borderRadius: 1.25,
		backgroundColor: colors.textPrimary,
	},
});
