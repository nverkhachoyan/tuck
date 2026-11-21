import { withSkia } from "@/platform/withSkia";
import { EditorOpening } from "@/screens/editor/EditorOpening";

export default withSkia(
	() => import("@/screens/editor/EditorScreen"),
	EditorOpening,
);
