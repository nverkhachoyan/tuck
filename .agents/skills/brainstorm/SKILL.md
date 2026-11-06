---
name: brainstorm
description: >-
  Starts a grounded brainstorm on a product, design, or engineering problem:
  frames it, describes how the code works today, researches prior art with
  sources, writes a range of ideas with costs, recommends an order, has three
  independent reviewers test the draft, and hands off to a debate or to a
  decided direction. Writes Markdown only, in a brainstorming folder. Use when
  the user asks to brainstorm, explore options, or think through how something
  should work before deciding. First step of Brainstorm -> Debate -> Judge ->
  Plan from direction.
---

# Brainstorm

Turns a problem into a folder of documents someone can decide from: what's
true today, what others do, what could be done, and what to do first. Every
claim about the code is checked in the code; every claim about other products
has a source or says it doesn't.

It's the first of four skills that run in order:

1. **brainstorm** (this one): the options and a recommendation.
2. **structured-debate**: three positions argued against weighted criteria, when the recommendation is contested.
3. **debate-judge**: independent rulings on the debate.
4. **plan-from-direction**: an implementation plan from the direction the person decides on.

## 1. Inputs

- **The problem** (required): what hurts, or what should exist. If the request is only a topic, ask what prompted it before starting.
- **Folder**: the repository's brainstorming folder if it has one, else `docs/brainstorming/<short-slug>/`. Ask only if neither fits.
- **Scope limits** the person gives (time, what's off the table). Record them in the README.

Before anything else, read the repository's own instructions (`AGENTS.md`,
`CLAUDE.md`, and what they point to for architecture, product principles, and
design). They're the constraints the ideas have to meet.

## 2. Documents

Write them in this order. Names can follow the repository's style; the
content can't be skipped.

| File | What it holds |
| --- | --- |
| `README.md` | The problem in a paragraph, the short answer once there is one, and a line per document. Written first, finished last. |
| `current-model.md` | How it works today, read from the code at a named commit (`git rev-parse --short HEAD`): the model, the rules, what follows for the person using it, and the limits any change must keep (rendering, data, compatibility, the repository's stated constraints). Cite files and functions. |
| `prior-art.md` | How comparable products handle it, grouped into families by approach, each finding with a source and a confidence (high, medium, low). Ends with the lessons for this product. Prefer the products its users already know over impressive ones. |
| `ideas.md` | A range of ideas, from a small change to a large refactor (usually six to ten). Each: what the person sees, what changes in the code (files, functions), cost (XS under a day, S a day or two, M about a week, L more), and what it leaves undone or makes worse. Then "Also considered", one line each for what was ruled out quickly and why. |
| `recommendation.md` | Which ideas, in what order, and why; what's not recommended and why; the details a builder would otherwise miss; open questions; what building it touches. |
| `review.md` | What the reviewers found, what changed because of it, and what was declined and why. |

Rules for the content:

- **Verify, don't recall.** Read the function before describing it. When a claim rests on an assumption, say so.
- **What the person sees first**, then the code. An idea with no visible effect has to say why it matters anyway.
- **Costs are honest.** Name the part that makes something expensive. A cost that depends on a measurement says so, and what to measure.
- **No idea is a strawman.** Give each its best case, then its cost.
- Keep the repository's writing voice; don't pad.

## 3. Review

Once the first draft is complete, three reviewers read it independently,
each with one job (subagents in parallel where the harness has them,
otherwise three separate passes without looking back at the others' notes):

1. **Facts and feasibility**: check every claim about the code against the code, and whether each idea could be built as described, at the stated cost.
2. **Fit**: judge the recommendation against the product's users and stated principles.
3. **Devil's advocate**: argue for what the draft rejected or dismissed.

Each reviewer writes its findings in its reply, not into the folder. Revise
the documents, then write `review.md`: what changed the recommendation, what
changed the details, and what was declined, with why.

## 4. Hand off

Finish the README's short answer, then tell the person which way it goes next:

- **Contested**: if reviewers or the evidence leave two or three credible positions, name them (two contrasting scopes and a disciplined minimal option is a good default) and suggest `structured-debate` with this folder as the debate directory.
- **Settled**: if one answer clearly wins, say so and suggest the person write, or ask for, a direction document (the decisions they're making, in this folder), which `plan-from-direction` turns into a plan.

The direction is the person's decision. Don't write one as if it were made.

Commit only if asked, with the repository's commit convention.
