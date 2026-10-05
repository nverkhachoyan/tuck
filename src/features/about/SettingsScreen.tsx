import { reloadAppAsync } from "expo";
import { useState } from "react";
import { writePreference } from "@/lib/preferenceStore";
import { useStore } from "@/store";
import { THEME_PREFERENCE, type ThemeSetting, themeSetting } from "@/theme";
import { Segmented } from "@/ui/Segmented";
import { InfoPage, Paragraph, Section } from "./InfoPage";

const THEMES: { value: ThemeSetting; title: string }[] = [
	{ value: "system", title: "System" },
	{ value: "light", title: "Light" },
	{ value: "dark", title: "Dark" },
];

// Long enough for the highlighter to swipe onto the choice before the app
// reloads in the new palette.
const RELOAD_DELAY = 250;

export default function SettingsScreen() {
	const [chosen, setChosen] = useState(themeSetting);
	// A reload would drop edits still being saved, so wait until they are.
	const sessionOpen = useStore((state) => state.document !== null);

	const choose = (value: ThemeSetting) => {
		if (value === chosen) return;
		setChosen(value);
		writePreference(THEME_PREFERENCE, value);
		// Every style reads the palette as it's created (`theme.ts`).
		setTimeout(() => void reloadAppAsync("Theme changed"), RELOAD_DELAY);
	};

	return (
		<InfoPage title="Settings">
			<Section title="Appearance">
				<Segmented
					accessibilityLabel="Appearance"
					options={THEMES}
					selected={THEMES.findIndex(({ value }) => value === chosen)}
					disabled={sessionOpen}
					onSelect={(index) => choose(THEMES[index].value)}
				/>
				<Paragraph muted>
					System follows your device's light or dark setting.
				</Paragraph>
			</Section>
		</InfoPage>
	);
}
