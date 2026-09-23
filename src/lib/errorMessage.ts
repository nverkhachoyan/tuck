/**
 * A caught error as text for the user: its message, without the "Error: "
 * that `String(error)` puts in front.
 */
export function errorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: "Something went wrong.";
}
