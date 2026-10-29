export type Fields = Record<string, unknown>;

export function isFields(value: unknown): value is Fields {
	return typeof value === "object" && value !== null;
}

export function isPositive(value: unknown): boolean {
	return typeof value === "number" && value > 0;
}

export function isColorOrNull(value: unknown): boolean {
	return value === null || typeof value === "string";
}
