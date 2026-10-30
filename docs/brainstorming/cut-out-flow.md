# Cut out: a better flow

Brainstorm, 2026-10-29. Reviews how Cut out works today and proposes flows that separate *choosing what* from *deciding what happens to it*, the way Photoshop's selection tools do.

## How it works today

Code: `src/editor/tools/cutout/` (`useCutOutTool.ts`, `useCutOut.ts`, `CutOutPanel.tsx`, `cutMask.tsx`), detection in `src/editor/detection/subjectDetection.ts`.

1. **Opening the tool acts at once.** `start()` runs `find(image)` on an image that isn't cut yet: subject detection (Vision / ML Kit / MediaPipe) finds every subject, and `setMask` writes the result to the layer's `mask` straight away. The canvas shows what's kept washed green and what's removed dimmed and washed red.
2. **Refining edits that same mask.** The dock has Subjects (find all again), Pick (tap an object: MobileSAM where it's ready, otherwise the subject under the tap), Keep and Erase brushes (soft or hard, five sizes), and, once there's a cut, Invert and Redact.
   - Pick infers whether to add or subtract: if the cut already shows the tapped spot, the tap removes that object, otherwise it adds it (`cutShowsAt`).
   - Tapping the same spot again cycles through SAM's masks, small to large and back (`pickGrowth.ts`).
3. **✓ commits; ✕ cancels.** All of it runs inside one editor session (`beginSession` / `commitSession` / `cancelSession`). ✓ leaves the layer masked, background transparent. The mask stays non-destructive (Reset, reopen to refine), but the only outcome on offer is "hide everything outside".
4. **Side exits.** Redact turns the cut's shape into a masked redaction and closes the tool. Stickers save a cut image as its cut-out shape (`useStickerSave.ts`).

## What's wrong with it

- **The tool acts before you say what you want.** Opening Cut out removes the background before you've said what you're after. Someone who wants one object out of three, or wants to *remove* the subject, starts by undoing what the tool guessed.
- **Selection and result are the same thing.** The mask *is* the cut, so there's no state where you have chosen something but not yet decided what happens to it. Redact already works around this: it's a second "what to do with the selection" action, crammed into the same dock as the selection tools.
- **Only one outcome.** You can keep the selection and hide the rest. "Hide the selection", "copy it to its own layer and keep the photo whole", and "save it as a sticker" each take Invert, a duplicate photo, or a trip through another tool.
- **Invisible modes.** Whether a tap adds or subtracts depends on where it lands, and the grow-on-repeat cycle is only discoverable by accident.
- **An ambiguous name.** "Cut out" reads as both "cut this out (remove it)" and "cut this out (lift it)". In fact it removes the background, which is the opposite of the first reading.
- **A slow first impression.** The very first thing the tool shows is a spinner while detection runs, before you've done anything.

## Reference points

- **Photoshop.** Object Selection, Select Subject, and Quick Selection only *select* (marching ants, Shift to add, Alt to subtract). What happens next is a separate choice: Layer via Copy, Add Mask, Delete, Fill. "Remove Background" is its own one-click action that adds a mask.
- **iOS Photos, "Lift subject".** Long-press the subject, then pick Copy, Share, or Add Sticker. Selecting and acting are separate, and the subject is the default.
- **One-tap background removers in other apps.** One button removes the background, then Erase and Restore brushes fix the edge. That's today's Cut out, honestly named.

The pattern: **selecting is a mode, and the result is a verb you pick afterward.** Background removal is common enough to get its own one-tap shortcut.

## Flow options

### A. Select, then act (rename to "Select")

Opening the tool changes nothing. You build a selection, then pick what happens to it.

1. **Open:** the photo is unchanged, and detection warms up in the background (`prepareObjectSelection` already does this for Pick). The dock shows the selection tools.
2. **Select:**
   - **Subject** chip: selects every subject (today's Subjects button, without applying it).
   - **Tap**: adds the object under the finger (SAM). After a tap, a small **Smaller · Larger** stepper replaces the hidden tap-again cycle.
   - **Add** and **Subtract** brushes (today's Keep and Erase, renamed for what they do to a *selection*).
   - **Add/Subtract mode** for taps: an explicit +/− toggle on touch, and Shift / Alt on web like Photoshop, instead of guessing from where the tap lands.
   - **Invert**: the selection becomes everything else, which is also "select background".
   - Only the selection is washed, in `colors.selection` per AGENTS.md. Nothing is dimmed or removed yet.
3. **Act:** once there's a selection, an action row replaces the selection tools (or sits beside ✓):
   - **Cut out**: keep the selection, hide the rest (today's outcome, `setMask`).
   - **Remove**: hide the selection (inverted mask). Without inpainting it leaves a hole, so say so plainly. Content-aware fill is a separate, later idea (see Out of scope).
   - **Copy to layer**: a new image layer of the same photo with the selection as its mask, on top. The original stays whole. This is the compositing move and the natural route to a sticker.
   - **Redact**: today's Redact, which finally sits with the other verbs.
   - **Save sticker**: save the selection as a sticker without leaving the editor.

Good: one mental model, every outcome in one place, and nothing happens until you ask. Redact stops being an odd extra.
Bad: removing a background, the most common job, goes from one tap to two or three (open → Subject → Cut out).

### B. Two tools: "Remove BG" plus "Select"

Split by intent:

- **Remove BG**: today's flow under an honest name. One tap finds the subject and applies it, with Keep and Erase to fix the edge, then ✓. No Pick, no Invert, no Redact.
- **Select**: option A without its Cut out action, or with it if both tools share the engine.

Good: the quick job stays one tap, and the precise job gets a real tool.
Bad: two tray slots for overlapping work, and you have to know which to open. Refining a removed background wants the same brushes as Select, so the two tools drift toward each other.

### C. One tool, choose an intent on entry

Cut out opens to two large choices, **Remove background** and **Select an object**, then goes down B's path for whichever you pick. This is the "nested option" form of B.

Good: one tray slot.
Bad: an extra tap every time, including for the common job. Choice screens in a quick markup app feel like a wizard.

### D. Smallest change: suggest, don't apply

Keep Cut out as it is, except that on open the found subject appears as a *selection* (wash only) with a prominent **Remove background** button. Nothing changes until you press it or start refining.

Good: one small change, and it fixes "acts before you say".
Bad: selection and result are still fused after the first action, and there are still no other outcomes.

## Recommendation

**A with B's shortcut, on one engine:**

- Rename Cut out to **Select** and make it option A: select first, then an action row (Cut out · Remove · Copy to layer · Redact · Sticker).
- Add **Remove BG** as a thin tray tool. It opens Select already in "Subject + Cut out", landing on the refine state with the Add and Subtract brushes and ✓. That's one tap for the common case, and the same code, wash, and brushes. Under the hood it's Select with a preset, not a second implementation.
- Fall back to D first if this needs to ship in stages: it's a day's change and fixes the worst part.

## Decisions (2026-10-29)

Plan A plus Remove BG, with these changes:

- **The tool is called "Cut", not Select or Cut out.** "Select" is saved for a future tool that picks layers and objects by finger or cursor. "Cut out" is retired.
- **Cut, then act.** Cut builds a selection (Subject, Tap, Add/Subtract, Invert), and nothing changes until you pick an action.
- **Copy to layer is the default action.** It puts the selection on a new layer and leaves the photo whole.
- **Remove BG is its own button in the tray, a quick action.** It removes the background automatically. To fix the edge, open Cut on the result.

### Still to settle

1. **What does "Cut" do by default?** Everywhere else, Cut (⌘X) takes something *out* of where it was, and a copy leaves it in place. A default of Copy under a tool called Cut is a small contradiction, but probably fine as long as the action's label says what it does. Two ways to go:
   - Keep **New layer** (a copy) as the default and label it that way. The photo stays whole, which is the safe choice without inpainting. *(Recommended.)*
   - Make the default **Layer via cut**, Photoshop's ⌘⇧J: the selection moves to its own layer and leaves a transparent hole in the photo. That matches the name, but the hole shows the moment you move the new layer.
   - Either way, the old "Cut out" outcome becomes **Keep only**, so the dock never reads "Cut → Cut out".
2. **Opening Cut on a layer that's already cut** (after Remove BG, say). The selection should start from the layer's current cut, and the main action becomes **Update cut**, which writes the mask back as today's ✓ does. Copy to layer as the default makes sense for a fresh selection, not for touching up a mask.
3. **What Remove BG does after it runs.** It applies at once as one undo step, with no session to accept, then shows a short notice with a **Refine** button that opens Cut on that layer (as in point 2). No separate refine screen, so there's one place to edit cuts.

Resulting actions in Cut: **New layer** (default for a fresh selection) · **Keep only** · **Remove** · **Redact** · **Sticker**, or **Update cut** when the layer already has a cut.

## What changes under the hood

- **The selection becomes tool state, not the layer's mask.** During the session, keep the working selection (a mask file plus strokes) in the controller or store and draw it as an overlay. Only the chosen action writes the document: `setMask` (Cut out), `invertMask` (Remove), a new `addImage` layer with the mask (Copy), or `addMaskedRedaction` (Redact). That also keeps a cancelled selection out of undo history.
- **Most of the mask math exists.** `combineMasks` (add/subtract), `invertedMask`, `renderCutShape`, and `renderCutOut` (stickers) cover every action. The `pick` add/remove logic stays, but takes its mode from the UI instead of `cutShowsAt`.
- **Drawing the selection.** The wash comes from `Tint` over the selected region. For an edge like marching ants, a morphology dilate of the mask minus the mask gives an outline. Morphology works on Skia web, where runtime shaders don't (see AGENTS.md, Skia).
- **Pick sizes.** `findObjectMasks` already returns several masks and a `likeliest` index. The Smaller · Larger stepper just exposes `index`.
- **Settings.** `CutOutSettings.tool` values change (`pick` → `tap`, `keep`/`erase` → `add`/`subtract`). `parseCutOutSettings` already falls back per field, so old saved settings degrade to defaults.
- **Specs.** Cut is a normal tool (`tools/cut/`). Remove BG is a tray action, not a tool with a session: it runs subject detection, then `setMask` as one undoable step, then announces with a Refine button that opens Cut. Check whether the tray supports an action with no mode, or whether that needs a small addition to `ToolSpec`.
- **Docs to update:** `docs/architecture.md` (tool folder name) and any `docs/interactive` lesson that names Cut out.

## Naming

| Name | Reads as | Notes |
|---|---|---|
| **Select** | choose part of the photo | Clear and familiar from Photoshop. Collides with "selected layer" in the UI (the highlighter-yellow chosen state). |
| Lift | pull the subject out | Apple's word. Friendly, but less clear for removing or redacting. |
| Isolate | separate the subject | Precise, a bit technical. |
| Cut out | ambiguous | Keep it as the *action* name ("Cut out" = keep the selection), not the tool's. |
| **Remove BG** | remove the background | Clear. "BG" is jargon. Spelled out, "Remove background" may not fit the dock label, so check the width. |

## Open questions

- Does **Select** clash too much with layer selection? If it does, **Lift** is the next pick.
- Should Remove BG be a tray tool, or Select's first chip? (A tray tool is recommended: it's the job people come for.)
- Should **Copy to layer** be the default action rather than Cut out? It's non-destructive to the photo, but changes what ✓ means today.
- Is **Remove** without inpainting useful on its own (a transparent hole for compositing), or does it need fill first?
- Should the action row replace ✓, or should ✓ stay as "apply the last-used action"?

## Out of scope

- **Content-aware fill** for Remove: on-device inpainting (a LaMa-class ONNX model, on the same runtime as MobileSAM) is its own research piece, with model size and web performance to measure first.
- Edge refinement (hair and fur matting) beyond the soft brushes.
