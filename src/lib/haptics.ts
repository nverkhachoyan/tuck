import * as Haptics from "expo-haptics";

/** A light tick as something settles into place, like a snap or a new slot. */
export function hapticTick() {
	void Haptics.selectionAsync();
}
