import { useEffect, useState } from "react";
import { Welcome } from "./lessons/Welcome.tsx";
import { chapters, findLesson } from "./lessons.ts";

function readHash(): string[] {
	return window.location.hash.replace(/^#\/?/, "").split("/");
}

function useHashRoute(): string[] {
	const [route, setRoute] = useState(readHash);
	useEffect(() => {
		const onChange = () => {
			setRoute(readHash());
			window.scrollTo(0, 0);
		};
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);
	return route;
}

export function App() {
	const [chapterId = "", lessonId = ""] = useHashRoute();
	const found = findLesson(chapterId, lessonId);

	return (
		<div className="shell">
			<nav className="sidebar" aria-label="Lessons">
				<a className="wordmark" href="#/">
					<span>Inside Tuck</span>
				</a>
				{chapters.map((chapter, chapterIndex) => (
					<section key={chapter.id}>
						<h2>
							<span className="chapter-number">{chapterIndex + 1}</span>
							{chapter.title}
							<code>{chapter.folder}</code>
						</h2>
						<ul>
							{chapter.lessons.map((lesson) => {
								const chosen =
									found?.chapter === chapter && found.lesson === lesson;
								return (
									<li key={lesson.id}>
										{lesson.component ? (
											<a
												href={`#/${chapter.id}/${lesson.id}`}
												className={chosen ? "chosen" : undefined}
												aria-current={chosen ? "page" : undefined}
											>
												{lesson.title}
											</a>
										) : (
											<span className="soon">
												{lesson.title}
												<small>soon</small>
											</span>
										)}
									</li>
								);
							})}
						</ul>
					</section>
				))}
			</nav>
			<main className="content">
				{found?.lesson.component ? (
					<found.lesson.component key={`${chapterId}/${lessonId}`} />
				) : (
					<Welcome />
				)}
			</main>
		</div>
	);
}
