import { useEffect, useRef, useState } from "react";

/**
 * Listens on the window for an image pasted (a screenshot on the clipboard,
 * say) or dropped, and hands `onPhoto` a blob URL for it, revoked once
 * `onPhoto` is done. A paste into a text field is left alone.
 */
export function usePhotoDrop({
	enabled,
	onPhoto,
}: {
	enabled: boolean;
	onPhoto: (uri: string) => Promise<void>;
}): { dragging: boolean } {
	const [dragging, setDragging] = useState(false);
	// The latest callback, so a new one each render doesn't re-add listeners.
	const handler = useRef(onPhoto);
	useEffect(() => {
		handler.current = onPhoto;
	});

	useEffect(() => {
		if (!enabled) return;
		// Enter and leave fire for every element crossed; the drag has left
		// the page once they balance.
		let depth = 0;
		const hand = (file: File | undefined) => {
			if (!file) return;
			const uri = URL.createObjectURL(file);
			void handler.current(uri).finally(() => URL.revokeObjectURL(uri));
		};
		const endDrag = () => {
			depth = 0;
			setDragging(false);
		};

		const handlePaste = (event: ClipboardEvent) => {
			if (isTextField(event.target)) return;
			const file = firstImage(event.clipboardData?.files);
			if (!file) return;
			event.preventDefault();
			hand(file);
		};
		const handleDragEnter = (event: DragEvent) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			depth++;
			setDragging(true);
		};
		// Without this, the browser opens the dropped file itself.
		const handleDragOver = (event: DragEvent) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
		};
		const handleDragLeave = (event: DragEvent) => {
			if (!carriesFiles(event)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const handleDrop = (event: DragEvent) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			endDrag();
			hand(firstImage(event.dataTransfer?.files));
		};

		window.addEventListener("paste", handlePaste);
		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);
		return () => {
			window.removeEventListener("paste", handlePaste);
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
			endDrag();
		};
	}, [enabled]);

	return { dragging };
}

function firstImage(files: FileList | undefined) {
	return Array.from(files ?? []).find((file) => file.type.startsWith("image/"));
}

function carriesFiles(event: DragEvent) {
	return event.dataTransfer?.types.includes("Files") ?? false;
}

function isTextField(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement)
	);
}
