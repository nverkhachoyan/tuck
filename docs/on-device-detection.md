# On-device detection

Research into three features, done in September 2026:

* Detect faces, so they can be redacted in one step.
* Detect text, so it can be redacted in one step.
* Remove a photo's background (Stage 4).

Everything must run on the device. No external APIs, no cloud inference, and no photo ever leaves the phone or the browser.

## Recommendation

On iOS and Android, don't install a third-party package. Write one local Expo module over the platforms' own tools: Apple Vision on iOS and Google ML Kit on Android. On web, use two libraries: `@mediapipe/tasks-vision` and `tesseract.js`.

No single dependency covers all three features. The closest, `react-native-nitro-vision-kit`, does background removal and text but not faces, needs iOS 18 for text, and has no web version. On web, MediaPipe covers faces and background removal but has no text recognition.

This widens the background-removal module that VISION.md's Stage 4 first called for (`modules/image-segmentation/`) into `modules/image-analysis/`, and Stage 4 now covers all three features. They need the same development build, so faces and text cost little extra alongside background removal.

## Dependencies

### Native (iOS and Android)

1. **A local Expo module**, `modules/image-analysis/`, with three functions:
   * `detectFaces(uri)` returns a rectangle in image pixels for every face.
   * `detectText(uri)` returns a rectangle in image pixels for every line, and for every word in it.
   * `subjectMask(uri, point)` writes a grayscale mask and returns its URI and size.

   iOS uses the Vision framework, which ships with the OS: no npm packages or CocoaPods. Android adds three Gradle artifacts, each a model Google Play services downloads on its own:
   * `com.google.android.gms:play-services-mlkit-face-detection` (about 800 KB added to the app)
   * `com.google.android.gms:play-services-mlkit-text-recognition` (Latin script, about 260 KB)
   * `com.google.android.gms:play-services-mlkit-subject-segmentation` (beta, about 200 KB)
2. **`expo-dev-client`**, since the app leaves Expo Go once it has a native module.

### Web

3. **`@mediapipe/tasks-vision`** (Apache 2.0), for faces and background removal. Both share one WebAssembly runtime of about 11.8 MB.
4. **`tesseract.js`** (Apache 2.0), for text: about 2.9 MB of WebAssembly, plus about 3 MB of English language data.

Serve every WebAssembly file and model from the app's own `public/` folder, not the libraries' default CDNs (jsDelivr and Google's storage). Then the page makes no third-party requests, and detection works offline once cached. MediaPipe takes the paths in `FilesetResolver.forVisionTasks` and each task's `modelAssetPath`; Tesseract takes `workerPath`, `corePath`, and `langPath`.

## Per feature

| | iOS: Apple Vision | Android: ML Kit | Web |
|---|---|---|---|
| Faces | `VNDetectFaceRectanglesRequest` | Face detection | MediaPipe Face Detector, full-range model |
| Text | `VNRecognizeTextRequest` | Text recognition v2 | `tesseract.js` |
| Background | `VNGenerateForegroundInstanceMaskRequest` (iOS 17+) | Subject segmentation | MediaPipe Interactive Segmenter, MagicTouch model |

### Faces

* **iOS:** `VNDetectFaceRectanglesRequest` returns every face's box. On the simulator it needs to be pinned to the CPU (see below).
* **Android:** ML Kit face detection returns every face's box. Google advises faces of at least 100×100 pixels, and its default `minFaceSize` is 0.1 (a head a tenth of the image's width), so lower it for group photos. If ML Kit misses too many small faces, MediaPipe's Android tasks run the same full-range model as web.
* **Web:** MediaPipe's Face Detector with **`blaze_face_full_range`** (1.1 MB). Its default short-range model (230 KB) is built for selfies from a front camera and misses the small faces in group photos and back-camera shots. The sparse full-range model its docs describe isn't published (a 404 in September 2026).

Tried on three photos with 9 to 36 faces, 3000 pixels wide (September 2026), Vision and MediaPipe found no faces in a group photo whose faces are about 50 pixels wide, since each looks at the image shrunk to a few hundred pixels. Looking at overlapping tiles too (half and a quarter of the longer side) found 31 on iOS and 25 on web. ML Kit with `minFaceSize` 0.02 found 36 in the whole image, and tiling it only made it seven times slower. The full-range model isn't on npm (`@mediapipe/tasks-vision` ships only the WebAssembly, and the deprecated `@mediapipe/face_detection`'s copy lacks the metadata the Tasks API reads), so version 1 is kept in the repository at `modules/image-analysis/models/`.

### Text

* **iOS:** `VNRecognizeTextRequest` returns each line, and `boundingBox(for:)` returns the box of any range of it, so words can be redacted on their own.
* **Android:** ML Kit text recognition v2 returns blocks, lines, elements (words), and symbols, each with a box and corner points. Google advises characters of at least 16×16 pixels. Add only the Latin script; each other script is its own artifact.
* **Web:** `tesseract.js` returns blocks, paragraphs, lines, words, and symbols with boxes. It's strongest on screenshots, VISION.md's main redaction case, and weaker on text in photos (signs, license plates). If that matters, `ppu-paddle-ocr` (PaddleOCR on ONNX Runtime) detects text in photos better, but pulls in opencv.js (13 MB) and ONNX Runtime Web.

### Background removal

* **iOS:** `VNGenerateForegroundInstanceMaskRequest` separates every prominent subject (people, animals, objects) and returns a mask. It needs iOS 17, and only runs on a real device.
* **Android:** ML Kit subject segmentation returns a foreground confidence mask, or one per subject. It's in beta, needs Android API 24, and wants images of at least 512×512 pixels.
* **Web:** MediaPipe's Interactive Segmenter with the **MagicTouch** model (6.2 MB) returns a confidence mask for the object at a point. It needs that point: let the user tap the subject, or start from the image's center so it's still one tap. Its quality hasn't been tried on real photos yet. If its edges aren't good enough, run **BiRefNet-lite** (MIT) with `onnxruntime-web` instead, a 115 MB download (fp16).

Built (September 2026) with MagicTouch version 1 (`magic_touch.tflite`, 6.2 MB) through `InteractiveSegmenterLegacy`, with the point at the photo's center. `@mediapipe/tasks-vision` 1.0 also has a new `InteractiveSegmenter` for version 2 of MagicTouch (`interactive_segmentation.task`), which takes strokes, including a lasso, but is a 30 MB download; try it if version 1's edges aren't good enough. On two animal portraits, version 1 found each subject in under half a second with soft edges and a faint fringe of the background's color.

Return a mask, not a cutout. Skia applies the mask to the image layer, so the original photo stays untouched and a cutout can be refined or undone like a crop or an adjustment. Every native background-removal package reviewed returns a finished PNG with the background already gone.

## The simulator

These results come from a Swift program compiled for the simulator and run on the iPhone 17 Pro simulator (iOS 26.5, Xcode 27):

| Vision request | Simulator |
|---|---|
| `VNRecognizeTextRequest` | Works, with a box for every word |
| `VNDetectTextRectanglesRequest` | Works |
| `VNDetectFaceRectanglesRequest` | Fails ("Could not create inference context"), but works when pinned to the CPU |
| `VNGenerateForegroundInstanceMaskRequest` | Fails: it only offers the simulator's GPU |
| `VNGeneratePersonSegmentationRequest` | Fails ("E5RT is not supported") |

To detect faces on the simulator, pin the request to the CPU:

```swift
#if targetEnvironment(simulator)
if let devices = try? request.supportedComputeStageDevices {
	for (stage, list) in devices {
		if let cpu = list.first(where: { if case .cpu = $0 { true } else { false } }) {
			request.setComputeDevice(cpu, for: stage)
		}
	}
}
#endif
```

Background removal on iOS can only be tried on a real device.

ML Kit is worse off: its iOS binaries have no arm64 simulator slice, and Xcode 26 dropped Rosetta simulators, so an iOS build that links ML Kit can't run on an Apple silicon simulator at all. That rules out ML Kit on iOS.

## Rejected

| Package | Why |
|---|---|
| `expo-face-check` | Returns only the single dominant face (or that there are several), never every face |
| `@react-native-ml-kit/face-detection`, `@react-native-ml-kit/text-recognition` | Use ML Kit on iOS too (`GoogleMLKit` 8.0.0), which can't run on the simulator; the text package bundles Chinese, Japanese, Korean, and Devanagari models; an Objective-C bridge |
| `expo-text-extractor` | Returns recognized strings with no positions |
| `react-native-background-remover` | Last published December 2024; returns a finished cutout, not a mask |
| `@six33/react-native-bg-removal` | Below iOS 17 its "fallback" is an error telling the app to call a remote API; returns a finished cutout; refuses to run on the simulator |
| `react-native-nitro-vision-kit` | No face detection; text needs iOS 18; needs Nitro Modules; young (59 stars) |
| `@imgly/background-removal` | AGPL-3.0, which would require publishing the web app's source; downloads its models from IMG.LY's servers by default |
| RMBG-1.4 and RMBG-2.0 (BRIA) | Model weights licensed for non-commercial use only |
| ISNet (`onnx-community/ISNet-ONNX`) | Published as AGPL-3.0 |
| MODNet | Apache 2.0 and small (7 MB), but it only separates people (portraits) |
| `@huggingface/transformers` | Runs BiRefNet with a background-removal pipeline, but pins its own development build of ONNX Runtime; if BiRefNet is needed, `onnxruntime-web` alone does it with little code |

## Platform notes

* **iOS 16.** Expo SDK 57's minimum iOS is 16.4, but subject masks need iOS 17. Hide subject detection on 16.x (the module reports whether it's available) rather than raise the whole app's minimum.
* **Android without Google Play services** (Huawei phones, for example) can't run any of the ML Kit features, and on other phones the models download after install. The module reports what's available, and the UI hides what isn't. Declare the models in the manifest's `com.google.mlkit.vision.DEPENDENCIES` so they download at install rather than on first use.
* **Development build.** The app runs in `expo-dev-client` rather than Expo Go (`AGENTS.md` records how to build and reload it on the simulator and emulator).

## How it fits the editor

Faces and text come back as rectangles, which become ordinary redaction boxes: movable, resizable, and undoable like one drawn by hand. The background comes back as a mask, which becomes a property of the image layer that the editor, export, and thumbnails all apply. Detection only proposes layers and properties the document already describes; the only new drawing is the mask.

The web versions sit in the same module's `.web.ts` file, with the same three functions, as `projects/projectStorage.web.ts` does for storage. The editor doesn't know which implementation answered.

## Sources

* [expo-face-check](https://expo-face-check.dev/)
* [react-native-ml-kit](https://github.com/a7medev/react-native-ml-kit)
* [react-native-nitro-vision-kit](https://github.com/sagawrr/react-native-nitro-vision-kit)
* [react-native-background-remover](https://github.com/atlj/react-native-background-remover)
* [@six33/react-native-bg-removal](https://www.npmjs.com/package/@six33/react-native-bg-removal)
* [@imgly/background-removal](https://github.com/imgly/background-removal-js) and [its license](https://github.com/imgly/background-removal-js/blob/main/packages/web/LICENSE.md)
* ML Kit on Apple silicon simulators: [googlesamples/mlkit #810](https://github.com/googlesamples/mlkit/issues/810), [infinitered/react-native-mlkit #259](https://github.com/infinitered/react-native-mlkit/issues/259), [google_ml_kit_flutter #861](https://github.com/flutter-ml/google_ml_kit_flutter/issues/861)
* [Vision on the simulator](https://developer.apple.com/forums/thread/764948) (Apple Developer Forums)
* ML Kit on Android: [subject segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation/android), [face detection](https://developers.google.com/ml-kit/vision/face-detection/android), [text recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
* MediaPipe: [face detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector), [interactive segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/interactive_segmenter)
* [Tesseract.js performance](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md)
* [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr)
* Models: [BiRefNet_lite-ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX), [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)
