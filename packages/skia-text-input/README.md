# @tuck/skia-text-input

Edit text in place on a [React Native Skia](https://shopify.github.io/react-native-skia/) canvas: the text being typed is drawn exactly as it will look, at its size, angle, and wrapping, with a caret and selection drawn in the canvas too.

Private for now: it's built for [Tuck](https://tuck.tools)'s text layers, and published once something else needs it.

## How it works

* **A hidden input takes the keyboard.** `HiddenTextInput` is a real `TextInput` with its opacity at 0, so typing, autocorrect, paste, undo, and the software keyboard work as usual. You draw what it holds.
* **Skia draws the text, caret, and selection.** `createCaretLayout` measures them with the paragraph's own `getRectsForRange` and `getGlyphPositionAtCoordinate`.
* **Empty lines get a filler.** Skia gives an empty line no box, so the layout measures a copy with a `.` on each empty line and maps indexes between the two.
* **Presses on the canvas place the caret.** `useCanvasTextGesture` turns taps, drags, and double taps into selections, through a `toIndex` you write from your canvas's own transform.

## Install

```sh
npm install @tuck/skia-text-input react-native-skia
npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler
```

There are two entry points:

* **`@tuck/skia-text-input/core`:** plain TypeScript, plus Skia's types: `createCaretLayout`, `caretText`, `wordRange`, `clampSelection`. It needs only `react-native-skia`.
* **`@tuck/skia-text-input`:** everything in `/core`, plus the React Native parts: `HiddenTextInput`, `Caret`, `SelectionHighlight`, and `useCanvasTextGesture`. They need Reanimated, Worklets, and Gesture Handler as well, which is why those are optional peers.

The package ships compiled JavaScript with `"worklet"` directives left in place, so your app's Babel config (Expo's preset includes it) must run the Worklets plugin on it, as it does for any Reanimated library.

## Example

One paragraph, edited at the canvas's origin with no zoom:

```tsx
import {
	Caret,
	clampSelection,
	createCaretLayout,
	HiddenTextInput,
	type HiddenTextInputHandle,
	SelectionHighlight,
	type TextSelection,
	useCanvasTextGesture,
} from "@tuck/skia-text-input";
import { useMemo, useRef, useState } from "react";
import { Keyboard, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";
import { Canvas, Paragraph, Skia } from "react-native-skia";

const WIDTH = 300;

function buildParagraph(text: string) {
	return Skia.ParagraphBuilder.Make()
		.pushStyle({ fontSize: 32, color: Skia.Color("black") })
		.addText(text)
		.build();
}

export function EditableText() {
	const input = useRef<HiddenTextInputHandle>(null);
	const [text, setText] = useState("Edit me in place");
	const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
	const [focused, setFocused] = useState(false);
	const paragraph = useMemo(() => {
		const built = buildParagraph(text);
		built.layout(WIDTH);
		return built;
	}, [text]);
	const layout = useMemo(() => createCaretLayout(text, WIDTH, buildParagraph), [text]);
	// One screen pixel in the canvas's units: 1 with no zoom.
	const pixel = useDerivedValue(() => 1);
	const shown = clampSelection(selection, text.length);

	const gesture = useCanvasTextGesture({
		text,
		toIndex: (x, y, clamp) => {
			const onText = x >= 0 && x <= WIDTH && y >= 0 && y <= paragraph.getHeight();
			return onText || clamp ? layout.indexAt({ x, y }) : null;
		},
		onSelect: (next) => input.current?.select(next),
		onDone: Keyboard.dismiss,
	});

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<HiddenTextInput
				ref={input}
				value={text}
				initialSelection={{ start: text.length, end: text.length }}
				onChangeText={setText}
				onSelectionChange={setSelection}
				onFocusChange={setFocused}
				onDone={Keyboard.dismiss}
			/>
			<GestureDetector gesture={gesture}>
				<View style={{ flex: 1 }}>
					<Canvas style={{ flex: 1 }}>
						{shown.start !== shown.end && (
							<SelectionHighlight rects={layout.selectionRects(shown)} />
						)}
						<Paragraph paragraph={paragraph} x={0} y={0} width={WIDTH} />
						{focused && shown.start === shown.end && (
							<Caret
								key={`${shown.start}:${text}`}
								rect={layout.caretRect(shown.start)}
								pixel={pixel}
							/>
						)}
					</Canvas>
				</View>
			</GestureDetector>
		</GestureHandlerRootView>
	);
}
```

The selection flows one way: a press calls `select` on the input, and the input reports where its selection went through `onSelectionChange`. The canvas only ever draws what the input holds.

## API

### `createCaretLayout(text, width, buildParagraph)`

Lays out `text` at `width` with a paragraph from `buildParagraph`, which it calls with its filler copy of the text, so build it with the same style you draw. Returns, in the paragraph's space from its top left:

* `caretRect(index)`: where a caret stands before `index`, as a zero-width rect.
* `selectionRects(selection)`: a box per line, with a narrow one on a selected empty line.
* `indexAt(point)`: the index nearest a point.

It builds a new paragraph each time it's called: cache it by your text and style.

### `HiddenTextInput`

* `value`, `onChangeText`: the text.
* `initialSelection`: where the caret starts, once the input first has focus.
* `onSelectionChange`, `onFocusChange`: what the input reports, for you to draw.
* `onDone`: Escape, ⌘/Ctrl+Enter, or Android's back button.
* `ref`: `focus()`, and `select(selection)` to move the caret or select.
* `style`: where it sits, by default the top 44 points. Focusing an input scrolls to it, so keep it where nothing scrolls, out of sight behind a header.
* `keyboardAppearance`, `accessibilityLabel`: passed through.

Its selection isn't a controlled prop: setting a `TextInput`'s selection on every change fights the platform's own, so it's placed once and moved with `select`.

### `Caret`

`rect` from `caretRect`, and `pixel`, a shared value holding one screen pixel in the canvas's units, so the caret keeps its width at any zoom. `color`, `haloColor`, `width`, `halo` (in screen pixels), and `blinkMs` have defaults. It blinks from when it mounts: key it by its index and the text, so it holds still while it moves and while typing.

### `SelectionHighlight`

`rects` from `selectionRects`, filled as one path so neighboring lines don't darken where they meet, and a see-through `color`.

### `useCanvasTextGesture(options)`

Returns a gesture for a `GestureDetector` over the canvas. A press on the text places the caret, a drag from it selects, a double tap selects a word, and a tap off the text calls `onDone`. A second finger cancels the press, leaving the fingers to your zoom or pan gestures.

* `text`: the text being edited.
* `toIndex(x, y, clamp)`: the index under a point in the view, or null off the text. With `clamp`, the nearest index anyway, for a drag that leaves the text. This is where your canvas's zoom, pan, and rotation go.
* `onSelect`, `onDone`.
* `onCursor`: `"text"` or `"default"`, for a mouse over the text on the web.
* `tapSlop`: how far a tap may travel, in view points (default 6).

## On the web

Skia's paragraphs on the web throw without a font provider: register your fonts with `Skia.TypefaceFontProvider.Make()`, pass it to `Skia.ParagraphBuilder.Make(style, provider)` in `buildParagraph`, and name a family in the text style. CanvasKit must also load before anything imports Skia.

## Not handled

Right-to-left text, input method composition drawn on the canvas, grapheme-aware word selection, up and down arrows by wrapped line on the web, drag handles and the edit menu on touch, and screen readers reading the drawn text.
