---
target: editor
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nverk/Dev/photo-editor/src/features/editor"
timestamp: 2026-10-04T21-46-39Z
slug: src-features-editor
---
Method: dual-agent (A: design review · B: detector + browser overlay)

# Critique: Editor (src/features/editor)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Silent autosave; Find progress and spinners good |
| 2 | Match System / Real World | 3 | "Photo" names the add-photo tool and the base layer; Stretch/Canvas/Both/Restore unclear |
| 3 | User Control and Freedom | 2 | ✕ discards a session unrecoverably (future: []); header blank in Text/Crop |
| 4 | Consistency and Standards | 2 | Esc = Done in tools, Cancel in Crop; Find's duplicate commit; gray option labels |
| 5 | Error Prevention | 2 | Drag on empty canvas moves a still-selected redaction; ✕ unconfirmed |
| 6 | Recognition Rather Than Recall | 3 | Style behind re-tapping the tool; Find inside Redact |
| 7 | Flexibility and Efficiency | 3 | No Export shortcut; `?` not discoverable |
| 8 | Aesthetic and Minimalist Design | 3 | ~200pt chrome on phone; desktop inspector mostly empty, rows clip |
| 9 | Error Recovery | 2 | Save banner has Retry but cloud icon; cancelled sessions lost |
| 10 | Help and Documentation | 2 | Shortcuts overlay web-only behind `?`; no text placeholder |
| Total | | 25/40 | Acceptable |

## Design Specificity Verdict
Marks are Tuck's (highlighter chosen state, meme-style caption default, blue detection candidates, print on table, graphite night); the structure is the stock mobile-editor kit. Redact, the differentiator, is the 3rd of 8 equal tiles. Detector: exit 0, 22 advisory design-system-color findings in the editor (12 test fixtures, 5 custom-swatch rainbow, rest intentional ink swatches + default pen color, undocumented in DESIGN.md) and 6 in src/ui (hue gradient, false positive). Browser overlay injected in a hidden pane tab; findings were false positives (RNW accessibility img, safe-area probe, checkerboard, highlight behind label) plus disabled Undo/Redo contrast (WCAG-exempt).

## What's Working
1. Find flow: pre-chosen blue candidates, count in title, one primary action.
2. Highlighter chosen state consistent across tools and both palettes; night is graphite.
3. Fixed-height dock; ✕/✓ in thumb zone; shortcut tooltips.

## Priority Issues
- [P1] ✕ permanently discards a tool session — src/store/editorSlice.ts:728 sets future: [] and there's no confirm. Fix: push cancelled session to future, or drop ✕ and rely on ✓ + Undo. (/impeccable harden)
- [P1] Stray drag can un-redact — after Redact ✓ the box stays selected and empty-space drags move it (canvas/useLayerTransformGesture.ts:72). Fix: deselect on finishing Redact (finishTool in EditorScreen.tsx), or move only on drags starting on the layer. (/impeccable harden)
- [P2] Header blank during Text and Crop — TextEditor.tsx:117 empty ScreenHeader over real header; CropTool overlay. Contradicts 10d3cf3. (/impeccable polish)
- [P2] Inconsistent commit/cancel — Esc meanings differ; Find's "Redact selected" and ✓ duplicate, then Redact ✓ still needed. (/impeccable distill)
- [P2] Gray option labels break No Gray Label rule — TextStylePanel.tsx:459, AdjustPanel.tsx:240, RedactPanel.tsx:333, CropTool.tsx:385/433, AddSheet.tsx. Fix: textPrimary. (/impeccable polish)

## Persona Red Flags
- Mid-chat Mia: lands in "Redaction" mode after ✓ where a drag uncovers the name; Find asks Faces/Text/Both first; no on-device reassurance.
- Casey: Undo/Layers/Export top-right; selection bar floats high; 9 crop ratios scroll.
- Alex: no Export shortcut; Esc inconsistency; header gone while typing; inspector clips fonts; `?` hidden.
- Sam: 1px default focus ring in selection blue; no live regions for Find count/Cut out/save error; textTertiary ~2.7:1; hidden input labelled "Text".

## Cognitive Load
3/8 failures (chunking, one thing at a time, minimal choices). Find stacks 4 control layers. >4 options: Redact panel 5, text tabs 5, fonts 5, selection bar 5, crop ratios 9, swatches 6+2, draw sizes 5, idle dock 8 (4+4).

## Minor Observations
- No header title/project name (DESIGN.md calls for one).
- TextEditor.tsx:113 keyboardAppearance="dark" in both palettes.
- Two black primaries during Find.
- Save banner cloud icon.
- No Saved / Deleted·Undo confirmation.
- No desktop text placeholder; rail tooltips cover next icon.

## Questions to Consider
- Does ✕ need to exist when every session is one undo step?
- Should a redaction ever move from a drag that didn't start on it?
- Share directly from the header instead of Export → sheet → Share?
- Open screenshots with Find proposing, or lead the dock with Text/Sticker/Redact?
