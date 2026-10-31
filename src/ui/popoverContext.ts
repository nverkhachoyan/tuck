import { createContext } from "react";
import type { PopoverPlacement } from "./popoverPlacement.ts";

/** Default placement for popovers mounted within this tree. */
export const PopoverPlacementContext = createContext<PopoverPlacement>("below");
