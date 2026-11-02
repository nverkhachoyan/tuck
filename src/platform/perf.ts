/**
 * Wraps performance.mark and performance.measure when __DEV__ is set and
 * the methods exist, and safely no-ops otherwise. Missing methods on Hermes
 * or restricted runtimes never throw.
 */

function isDevEnabled(): boolean {
	return typeof __DEV__ !== "undefined"
		? Boolean(__DEV__)
		: process.env.NODE_ENV !== "production";
}

let nextSpanId = 0;

const noop = () => {};

/**
 * Starts a performance span with the given name.
 * Returns a completion function that records the end mark and measure.
 */
export function startPerfSpan(name: string): () => void {
	if (!isDevEnabled()) return noop;
	const perf = typeof performance !== "undefined" ? performance : undefined;
	if (!perf || typeof perf.mark !== "function") return noop;

	const id = ++nextSpanId;
	const startMark = `${name}:${id}:start`;
	const endMark = `${name}:${id}:end`;

	try {
		perf.mark(startMark);
	} catch {
		return noop;
	}

	let ended = false;
	return () => {
		if (ended) return;
		ended = true;
		try {
			perf.mark(endMark);
			if (typeof perf.measure === "function") {
				perf.measure(name, startMark, endMark);
			}
			if (typeof perf.clearMarks === "function") {
				perf.clearMarks(startMark);
				perf.clearMarks(endMark);
			}
		} catch {
			// Safely ignore missing or failing User Timing methods in Hermes
		}
	};
}

/**
 * Measures the execution of a synchronous or asynchronous function as a named span.
 */
export function measurePerfSpan<T>(
	name: string,
	fn: () => Promise<T>,
): Promise<T>;
export function measurePerfSpan<T>(name: string, fn: () => T): T;
export function measurePerfSpan<T>(
	name: string,
	fn: () => T | Promise<T>,
): T | Promise<T> {
	if (!isDevEnabled()) return fn();
	const end = startPerfSpan(name);
	try {
		const result = fn();
		if (result && typeof (result as PromiseLike<unknown>).then === "function") {
			return (result as Promise<unknown>).finally(end) as Promise<T>;
		}
		end();
		return result;
	} catch (error) {
		end();
		throw error;
	}
}

export { measurePerfSpan as measureSpan, startPerfSpan as startSpan };
