import { requireOptionalNativeModule } from "expo";

/** The memory iOS charges the app, and how much more it may take, in bytes. */
export type ProcessMemory = { footprint: number; available: number };

type ProcessMemoryModule = { read(): ProcessMemory | null };

// iOS only; elsewhere there's nothing to read.
const native =
	requireOptionalNativeModule<ProcessMemoryModule>("ProcessMemory");

export function readProcessMemory(): ProcessMemory | null {
	return native?.read() ?? null;
}
