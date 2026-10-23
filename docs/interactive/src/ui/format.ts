/**
 * A number short enough to read: two decimals at most, but tiny values
 * keep their exponent, since that leftover is often the point.
 */
export function format(value: number): string {
	if (value !== 0 && Math.abs(value) < 1e-4) return value.toExponential(2);
	const rounded = Math.round(value * 100) / 100;
	return Object.is(rounded, -0) ? "0" : String(rounded);
}
