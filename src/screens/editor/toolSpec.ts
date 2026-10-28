/**
 * What the mode and the shortcuts need to know of one of the editor's tools,
 * in plain TypeScript beside its definition, so Node's tests can read it.
 * - `id`: its name in the mode.
 * - `target`: what it works on. "none" needs nothing; "photo" needs a photo
 *   to work in, and is put down when the last one goes; "image" works on
 *   the image it started on, and is put down when that one is hidden or
 *   gone.
 * - `tray`: whether it has a tray of options on the phone.
 * - `sized`: whether `[` and `]` step its brush.
 */
export type ToolSpec = {
	id: string;
	target: "none" | "photo" | "image";
	tray: boolean;
	sized: boolean;
};
