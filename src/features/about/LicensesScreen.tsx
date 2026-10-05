import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, space, typography, webTransition } from "@/theme";
import { interaction } from "@/ui/interaction";
import { creditGroups, type LicenseId, licenses } from "./credits";
import { InfoPage, Paragraph, Section } from "./InfoPage";

export default function LicensesScreen() {
	return (
		<InfoPage title="Licenses">
			<Paragraph>
				Tuck is built with fonts, images, and software that others made and
				share under the licenses below. Thank you to everyone behind them.
			</Paragraph>

			{creditGroups.map((group) => (
				<Section key={group.title} title={group.title}>
					{group.credits.map((credit) => (
						<View key={credit.name} style={styles.credit}>
							<Text style={styles.creditName}>{credit.name}</Text>
							<Text selectable style={styles.small}>
								{credit.notice}
							</Text>
							<Text style={styles.small}>{licenses[credit.license].name}</Text>
						</View>
					))}
				</Section>
			))}

			<Section title="License texts">
				{(Object.keys(licenses) as LicenseId[]).map((id) => (
					<LicenseText key={id} id={id} />
				))}
			</Section>
		</InfoPage>
	);
}

function LicenseText({ id }: { id: LicenseId }) {
	const [open, setOpen] = useState(false);
	const { name, text } = licenses[id];
	return (
		<View style={styles.license}>
			<Pressable
				onPress={() => setOpen((shown) => !shown)}
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				style={(state) => {
					const { pressed, hovered } = interaction(state);
					return [
						styles.licenseToggle,
						webTransition,
						hovered && styles.hovered,
						pressed && styles.pressed,
					];
				}}
			>
				<Text style={styles.creditName}>{name}</Text>
				<Ionicons
					name={open ? "chevron-up" : "chevron-down"}
					size={18}
					color={colors.textSecondary}
				/>
			</Pressable>
			{open && (
				<Text selectable style={[styles.small, styles.licenseText]}>
					{text}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	credit: {
		gap: 2,
		paddingVertical: space.xxs,
	},
	creditName: {
		...typography.bodyStrong,
		color: colors.textPrimary,
	},
	small: {
		...typography.label,
		lineHeight: 18,
		color: colors.textSecondary,
	},
	license: {
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		borderRadius: radii.medium,
		overflow: "hidden",
	},
	licenseToggle: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
	},
	hovered: {
		backgroundColor: colors.hoverOverlay,
	},
	pressed: {
		backgroundColor: colors.pressedOverlay,
	},
	licenseText: {
		paddingHorizontal: space.md,
		paddingBottom: space.md,
	},
});
