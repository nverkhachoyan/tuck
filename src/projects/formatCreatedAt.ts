// Absolute, so a label that uses it doesn't repeat home's "Today, 3:08 PM"
// or go stale. The device's locale fills in the words and the order.
const CREATED_AT: Intl.DateTimeFormatOptions = {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
};

/** When a project was made, as in "Oct 24, 3:15 PM". */
export function formatCreatedAt(time: number): string {
	return new Date(time).toLocaleString(undefined, CREATED_AT);
}
