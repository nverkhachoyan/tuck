import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
	type AlertButton,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import { colors, radii, typography } from "@/theme";
import { Button } from "@/ui/Button";

/**
 * React Native Web's `Alert.alert` does nothing, so errors would vanish and a
 * prompt guarding navigation would block it forever. This draws the alert in
 * the page instead, as its own React root over everything, with every
 * button. Escape or a click outside picks the cancel button, as does the
 * lone OK of an alert with no buttons.
 */
export function showAlert(
	title: string,
	message?: string,
	buttons: AlertButton[] = [],
) {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const root = createRoot(host);
	const returnFocus =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	// Keys typed in the dialog stop here, so the page's shortcuts don't act
	// on what's behind it.
	host.addEventListener("keydown", (event) => event.stopPropagation());

	let closed = false;
	const close = (button?: AlertButton) => {
		if (closed) return;
		closed = true;
		root.unmount();
		host.remove();
		returnFocus?.focus();
		button?.onPress?.();
	};

	root.render(
		<AlertDialog
			host={host}
			title={title}
			message={message}
			buttons={buttons.length > 0 ? buttons : [{ text: "OK", style: "cancel" }]}
			onClose={close}
		/>,
	);
}

function AlertDialog({
	host,
	title,
	message,
	buttons,
	onClose,
}: {
	host: HTMLElement;
	title: string;
	message?: string;
	buttons: AlertButton[];
	onClose: (button?: AlertButton) => void;
}) {
	const card = useRef<View>(null);
	const cancel =
		buttons.find((button) => button.style === "cancel") ??
		(buttons.length === 1 ? buttons[0] : undefined);
	// Cancel first, as the platforms order them.
	const ordered = [
		...buttons.filter((button) => button.style === "cancel"),
		...buttons.filter((button) => button.style !== "cancel"),
	];
	// Focus starts on the action, or on Cancel when the action destroys
	// something, so Return alone can't.
	const action = ordered.find((button) => button.style !== "cancel");
	const focusIndex =
		action && action.style !== "destructive" ? ordered.indexOf(action) : 0;

	useEffect(() => {
		const buttonsIn = () => [
			...(card.current as unknown as HTMLElement).querySelectorAll<HTMLElement>(
				'[role="button"]',
			),
		];
		buttonsIn()[focusIndex]?.focus();

		// Modal: keys meant for the page behind stop here, and Tab cycles
		// through the dialog's own buttons.
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				if (cancel) onClose(cancel);
				return;
			}
			if (event.key === "Tab") {
				const all = buttonsIn();
				const at = all.indexOf(document.activeElement as HTMLElement);
				const step = event.shiftKey ? -1 : 1;
				all[(at + step + all.length) % all.length]?.focus();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (!(event.target instanceof Node && host.contains(event.target))) {
				event.stopPropagation();
			}
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [host, cancel, focusIndex, onClose]);

	return (
		<View style={[styles.scrim, fixed]}>
			{/* Behind the card, so a click on the card doesn't count as outside.
				Closing on the click itself, not the press, leaves no click to
				land on the page once the dialog is gone. */}
			<Pressable
				style={StyleSheet.absoluteFill}
				focusable={false}
				accessible={false}
				onPress={() => {
					if (cancel) onClose(cancel);
				}}
			/>
			<View
				ref={card}
				role="alertdialog"
				aria-modal
				aria-label={title}
				style={styles.card}
			>
				<Text style={styles.title}>{title}</Text>
				{message ? <Text style={styles.message}>{message}</Text> : null}
				<View
					style={[styles.buttons, ordered.length > 2 && styles.buttonsStacked]}
				>
					{ordered.map((button, index) => (
						<View key={button.text ?? index} style={styles.button}>
							<Button
								label={button.text ?? "OK"}
								variant={
									button.style === "destructive"
										? "danger"
										: button.style === "cancel" && ordered.length > 1
											? "secondary"
											: "primary"
								}
								onPress={() => onClose(button)}
							/>
						</View>
					))}
				</View>
			</View>
		</View>
	);
}

// React Native's style types lack fixed positioning, which only web has.
const fixed = { position: "fixed" } as unknown as ViewStyle;

const styles = StyleSheet.create({
	scrim: {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 2000,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
		backgroundColor: colors.frostedScrim,
		backdropFilter: "blur(8px)",
		animationKeyframes: [{ from: { opacity: 0 }, to: { opacity: 1 } }],
		animationDuration: "140ms",
		animationTimingFunction: "ease-out",
	} as unknown as ViewStyle,
	card: {
		width: "100%",
		maxWidth: 360,
		padding: 22,
		borderRadius: radii.large,
		borderWidth: 1,
		borderColor: colors.glassBorder,
		backgroundColor: "rgba(32, 32, 36, 0.82)",
		backdropFilter: "blur(30px) saturate(160%)",
		boxShadow:
			"inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 24px 60px rgba(0, 0, 0, 0.6)",
		animationKeyframes: [
			{
				from: { opacity: 0, transform: "scale(0.96) translateY(6px)" },
				to: { opacity: 1, transform: "scale(1) translateY(0)" },
			},
		],
		animationDuration: "180ms",
		animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
	} as unknown as ViewStyle,
	title: {
		...typography.title,
		color: colors.textPrimary,
	},
	message: {
		...typography.label,
		marginTop: 6,
		lineHeight: 18,
		color: colors.textSecondary,
	},
	buttons: {
		flexDirection: "row",
		gap: 10,
		marginTop: 22,
	},
	buttonsStacked: {
		flexDirection: "column",
	},
	button: {
		flex: 1,
	},
});
