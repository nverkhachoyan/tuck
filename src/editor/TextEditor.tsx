import { useEffect, useState } from "react";
import {
	BackHandler,
	KeyboardAvoidingView,
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import type { TextAlign } from "@/model/document";
import { colors } from "@/theme";
import { TextButton } from "@/ui/TextButton";

const NEXT_ALIGN: Record<TextAlign, TextAlign> = {
	center: "left",
	left: "right",
	right: "center",
};

type TextEditorProps = {
	initialText: string;
	initialAlign: TextAlign;
	color: string;
	outlineColor: string;
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
	initialAlign,
	color,
	outlineColor,
	onDone,
}: TextEditorProps) {
	const [text, setText] = useState(initialText);
	const [align, setAlign] = useState(initialAlign);
	const done = () => onDone(text, align);

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
		<View style={styles.scrim}>
			{/* The input is the only thing on screen the keyboard could cover. */}
			<KeyboardAvoidingView behavior="padding" style={styles.flex}>
				<View style={styles.toolbar}>
					<Pressable
						hitSlop={12}
						onPress={() => setAlign(NEXT_ALIGN[align])}
						accessibilityRole="button"
						accessibilityLabel={`Text alignment: ${align}`}
					>
						<AlignIcon align={align} />
					</Pressable>
					<TextButton label="Done" tone="accent" onPress={done} />
				</View>

				{/* Tapping anywhere outside the text also finishes. */}
				<Pressable style={styles.inputArea} onPress={done}>
					<TextInput
						value={text}
						onChangeText={setText}
						autoFocus
						multiline
						placeholder="Type something"
						placeholderTextColor={colors.textSecondary}
						style={[
							styles.input,
							{ color, textAlign: align, textShadowColor: outlineColor },
						]}
					/>
				</Pressable>
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
	scrim: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.scrim,
	},
	flex: {
		flex: 1,
	},
	// Opaque, so the screen header underneath doesn't show through.
	toolbar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 14,
		backgroundColor: colors.background,
	},
	inputArea: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	input: {
		fontSize: 34,
		fontWeight: "700",
		// React Native can't stroke text, so a tight shadow stands in for the
		// outline while typing.
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 4,
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
