/**
 * Exhaustiveness guard for `switch` statements: passing a value that isn't
 * `never` is a compile error, so adding a union member (e.g. a new layer
 * type) flags every switch that hasn't handled it yet.
 */
export function assertNever(value: never): never {
	throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
