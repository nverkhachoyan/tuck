// The home screen's content column. Wide enough for a laptop's project
// prints to sit in a real row, and still a column on a larger display.
export const HOME_MAX_WIDTH = 1080;
export const GRID_PADDING = 16;
export const GRID_GAP = 16;

const MIN_CARD_WIDTH = 150;
const MAX_COLUMNS = 5;

/**
 * Column count and card width for a measured grid container width.
 * - Measures the inner grid view (excluding any outer scrollbar).
 * - Leaves a half-pixel slack across the row so fractional browser zoom never wraps the last card.
 */
export function gridLayout(width: number): {
	columns: number;
	cardWidth: number;
} {
	const inner = Math.max(0, Math.min(width, HOME_MAX_WIDTH) - GRID_PADDING * 2);
	const columns = Math.max(
		1,
		Math.min(
			MAX_COLUMNS,
			Math.floor((inner + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)),
		),
	);
	const available = Math.max(0, inner - GRID_GAP * (columns - 1) - 0.5);
	return { columns, cardWidth: available / columns };
}

/**
 * A project listed by its text shows it in sentence case: meme text is
 * usually all capitals, which shouts in a list.
 */
export function displayLabel(label: string) {
	if (label !== label.toUpperCase() || label === label.toLowerCase()) {
		return label;
	}
	return label.charAt(0) + label.slice(1).toLowerCase();
}

/** Today's time, "Yesterday", or the date, with the year once it's past. */
export function formatDate(time: number, now = new Date()) {
	const date = new Date(time);
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
