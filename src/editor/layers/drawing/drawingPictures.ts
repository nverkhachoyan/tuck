// One recorded picture per layer id. Callers hold the object they are still
// drawing: the view holds the picture it committed, and an offscreen draw
// holds each picture it recorded. A newer recording of the same id therefore
// can't dispose the picture a canvas or a scene is still replaying. Nothing
// is kept per strokes array, so undo history doesn't pin a picture per step.
// `later` is when a picture with no holders may be disposed.

type PictureKey = {
	strokes: readonly unknown[];
	multiply: boolean;
};

type Entry<T> = PictureKey & { picture: T };

export type PictureCache<T extends { dispose(): void }> = {
	pictureFor(id: string, key: PictureKey, record: () => T): T;
	hold(picture: T): () => void;
	beginDraw(): () => void;
};

export function createPictureCache<T extends { dispose(): void }>(
	later: (free: () => void) => void,
): PictureCache<T> {
	const current = new Map<string, Entry<T>>();
	const users = new Map<T, number>();
	const draws: Set<T>[] = [];
	let ticket = 0;
	const tickets = new Map<T, number>();

	function holdCount(picture: T) {
		return users.get(picture) ?? 0;
	}

	function addUser(picture: T) {
		users.set(picture, holdCount(picture) + 1);
	}

	function dropUser(picture: T) {
		const next = holdCount(picture) - 1;
		if (next > 0) {
			users.set(picture, next);
			return;
		}
		users.delete(picture);
		if (next === 0) schedule(picture);
	}

	// Only the latest schedule frees, and only once nothing holds the picture.
	// An earlier wait can end after a later user has taken it back.
	function schedule(picture: T) {
		if (holdCount(picture) > 0) return;
		const mine = ++ticket;
		tickets.set(picture, mine);
		later(() => {
			if (tickets.get(picture) !== mine) return;
			tickets.delete(picture);
			if (holdCount(picture) > 0) return;
			for (const [id, entry] of current) {
				if (entry.picture === picture) current.delete(id);
			}
			picture.dispose();
		});
	}

	function note(picture: T) {
		for (const draw of draws) {
			if (draw.has(picture)) continue;
			draw.add(picture);
			addUser(picture);
		}
	}

	return {
		pictureFor(id, key, record) {
			const cached = current.get(id);
			if (
				cached &&
				cached.strokes === key.strokes &&
				cached.multiply === key.multiply
			) {
				note(cached.picture);
				return cached.picture;
			}
			const picture = record();
			current.set(id, { ...key, picture });
			note(picture);
			if (cached && holdCount(cached.picture) === 0) schedule(cached.picture);
			return picture;
		},
		hold(picture) {
			addUser(picture);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				dropUser(picture);
			};
		},
		beginDraw() {
			const held = new Set<T>();
			draws.push(held);
			let released = false;
			return () => {
				if (released) return;
				released = true;
				const index = draws.indexOf(held);
				if (index !== -1) draws.splice(index, 1);
				for (const picture of held) dropUser(picture);
			};
		},
	};
}
