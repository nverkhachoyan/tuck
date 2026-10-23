import type { ComponentType } from "react";
import { AnatomyLesson } from "./lessons/model/AnatomyLesson.tsx";
import { FramingLesson } from "./lessons/model/FramingLesson.tsx";
import { IdentityLesson } from "./lessons/model/IdentityLesson.tsx";
import { StrokesLesson } from "./lessons/model/StrokesLesson.tsx";
import { TransformsLesson } from "./lessons/model/TransformsLesson.tsx";
import { withSkia } from "./lessons/render/loadSkia.ts";
import { HistoryLesson } from "./lessons/store/HistoryLesson.tsx";
import { SessionsLesson } from "./lessons/store/SessionsLesson.tsx";

export type Lesson = {
	id: string;
	title: string;
	summary: string;
	// Left out while the lesson is still to be written.
	component?: ComponentType;
};

export type Chapter = {
	id: string;
	title: string;
	folder: string;
	lessons: Lesson[];
};

// In the order a new reader should take them: the imports flow from the
// screens down to the model, so reading upward means every file only uses
// what's already been covered.
export const chapters: Chapter[] = [
	{
		id: "model",
		title: "The model",
		folder: "src/model",
		lessons: [
			{
				id: "transforms",
				title: "Two spaces and a transform",
				summary:
					"Document space, layer space, and the five numbers that map one onto the other.",
				component: TransformsLesson,
			},
			{
				id: "layers",
				title: "Anatomy of a layer",
				summary:
					"Every layer is content centered on its own origin, placed by a transform.",
				component: AnatomyLesson,
			},
			{
				id: "identity",
				title: "Same object, or a new one",
				summary: "Why edits return the layer itself when nothing changed.",
				component: IdentityLesson,
			},
			{
				id: "strokes",
				title: "Strokes into layer space",
				summary:
					"Drawn in document space, stored in the layer's own, and kept centered.",
				component: StrokesLesson,
			},
			{
				id: "framing",
				title: "Cropping moves an anchor",
				summary:
					"How the crop tool reframes one photo and every layer follows it.",
				component: FramingLesson,
			},
		],
	},
	{
		id: "store",
		title: "The store",
		folder: "src/store",
		lessons: [
			{
				id: "history",
				title: "Every edit is a snapshot",
				summary: "Actions, the undo history, and what isn't an edit.",
				component: HistoryLesson,
			},
			{
				id: "sessions",
				title: "A tool is one undo step",
				summary: "Sessions: where a tool starts, Done, and Cancel.",
				component: SessionsLesson,
			},
		],
	},
	{
		id: "render",
		title: "Rendering",
		folder: "src/render",
		lessons: [
			{
				id: "layer-content",
				title: "From layer to pixels",
				summary: "How each layer type draws, on screen and in export.",
				component: withSkia(() => import("./lessons/render/LayersLesson.tsx")),
			},
			{
				id: "export",
				title: "Export is the same scene",
				summary: "Drawing the document again, offscreen, and encoding it.",
				component: withSkia(() => import("./lessons/render/ExportLesson.tsx")),
			},
		],
	},
];

export function findLesson(
	chapterId: string,
	lessonId: string,
): { chapter: Chapter; lesson: Lesson; index: number } | null {
	const chapter = chapters.find((candidate) => candidate.id === chapterId);
	const index =
		chapter?.lessons.findIndex((candidate) => candidate.id === lessonId) ?? -1;
	return chapter && index >= 0
		? { chapter, lesson: chapter.lessons[index], index }
		: null;
}
