---
name: plan-from-direction
description: >-
  Writes an implementation plan from a decided direction document: checks the
  direction and any docs describing the code against HEAD, stops on what can't
  be built as written, asks the person one question at a time about choices
  that are theirs, orders the work into steps, and writes a README plus one
  file per step with edits, tests, docs, checks, manual checks, and a size.
  Plans only; writes no code. Use when the user asks to plan, break down, or
  write steps for a direction, spec, or agreed design. Last step of
  Brainstorm -> Debate -> Judge -> Plan from direction.
---

# Plan from a direction

Turns decisions someone has made into steps someone else can build, each
grounded in the code as it is now. The direction's decisions stand: the plan
orders the work and says where it lands, and comes back to the person when
the code says a decision can't hold.

## 1. Inputs

- **The direction** (required): the document of decisions, often written after a brainstorm and a judged debate. If it isn't clear which document decides, ask.
- **Supporting docs**: anything that describes the code (a brainstorm's `current-model.md`, a spec), and the commit each was written at.
- **Output folder**: the repository's plans folder if it has one (`docs/plans/<slug>/` otherwise).
- **What the person asked for on top**: steps that must exist (a measurement, a migration check), tests that must be written, housekeeping. Each lands in a named step.

Read the repository's instructions first (`AGENTS.md`, `CLAUDE.md`, and what
they point to: architecture, development and testing, design, known bugs,
open plans or follow-ups). The plan follows them and doesn't restate them:
the checks to run, docs to update with code, test conventions, and module
boundaries come from there.

## 2. Check before planning

1. **What changed since the docs were written.** `git log --oneline <commit>..HEAD` and `git diff --stat <commit> HEAD` over the source. Re-read every file the docs name, whether or not it changed: a doc can be wrong at its own commit.
2. **Every claim the plan will build on**, verified in the code: names, signatures, who calls what, which tests assert today's behavior.
3. **Gaps in the direction itself.** Look for:
   - Two sentences, often in different sections, that can't both hold, or a behavior its own cost estimate doesn't cover.
   - A behavior given for one entry point but not its siblings (one tool from the toolbar, another not; a keyboard shortcut; a context menu).
   - States between steps: what the person sees after step N but before N+1, and whether it misleads.
   - Shared code the direction treats as separate (two features on one type, function, or test).
4. **Stop rule.** When a decision can't be built as written, costs far more than the direction says, or contradicts itself, stop and tell the person, with the evidence and the options (recommendation first). Don't plan around it.
5. **Choices that are theirs** (unspecified behavior, a trade-off the direction didn't make): ask one question at a time, each standing on its own, with a recommendation. Record each answer in the README under "Decided while planning", with the wording the direction would need.

## 3. Order

- Follow the direction's suggested order unless the code argues for another; say why in the README.
- A step ships something coherent, or says plainly that it doesn't (a measurement, a refactor).
- **Gates**: when a later step's design depends on a number (performance, memory, size), make a measurement step before it, with what to build to measure, where (the oldest device that matters, a production build), a pass bar, and ordered fallbacks, each re-measured. Flag any fallback that bends a constraint the direction states: it needs the person's OK.
- Map every open question in the direction to the step that must settle it, and say whether before the step starts or before it ships.

## 4. The files

`README.md`:

- What it plans, the direction it follows, and the commit it was written at. What the supporting docs got wrong or left out, if anything.
- Decided while planning, with proposed wording for the direction (proposed, not made).
- A table of steps: link, size, what it needs, what can ship after it. Which steps can run in either order.
- Why the order differs from the direction's, if it does.
- Open questions, and the step that settles each.
- Compatibility: saved data, APIs, or formats the work touches, and how each step proves old data still works (or says no format changes).
- Overlap with open plans or follow-ups: which parts this covers, and the proposed edit as a diff, not made.
- The checks every step runs, from the repository's instructions.

One file per step, `NN-short-name.md`:

- **Settle first**: the open questions or results it waits on.
- **What the person sees** once it's done.
- **The edits**, by file, function, and type, as they are at HEAD. Respect the repository's layering rules (pure modules stay pure; thread or runtime annotations where the codebase uses them).
- **Tests** to add or change, by file and by name, including any the person asked for (a behavior that must never happen gets its own test).
- **Docs** to update in the same change, including generated or interactive docs that import the code.
- **Checks**: the repository's commands, and which apply to this step.
- **By hand**: the manual checks on each platform and size the repository's development docs name, and what only a real device can check.
- **Size**: XS (under a day), S (a day or two), M (about a week), L (more).

Write plainly and briefly, in the voice of the repository's existing docs.

## 5. Finish

- Don't write code. Don't edit the direction or the follow-ups; propose.
- Don't commit unless asked; suggest a commit message in the repository's convention.
- Tell the person what was decided, what changed from the direction's order, and what has to happen first (a measurement, an answer).
