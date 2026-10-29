---
name: structured-debate
description: >-
  Runs a structured multi-round debate between 3 subagents (Brief -> Blind
  Openings -> Cross-Rebuttals -> Crux Gate -> Closings -> Synthesis) to evaluate
  competing architectural, design, or product options against weighted criteria.
  Use when the user asks to run a debate on a question or grounding document,
  compare positions with subagents, or stress-test a technical decision.
---

# Structured 3-Way Subagent Debate

Orchestrates a disciplined, multi-round adversarial debate between 3 subagents (`A`, `B`, `C`) to decide an architectural, product, or engineering question grounded in the repository's actual code and documentation.

## 1. Required Inputs & Defaults

Before starting Step 0, resolve the following inputs from the user's request:

1. **Grounding Document(s) / Context (Required):** The file(s) or topic under debate (e.g., `docs/brainstorming/packages.md` or another spec/directory provided by the user). If the user has not specified a topic or grounding document, ask for it before starting.
2. **Question to Decide:** The core decision to resolve.
3. **Positions (`A`, `B`, `C`):**
   - If the user provides explicit positions (`A = ...`, `B = ...`, `C = ...`), use them verbatim.
   - If the user provides only the grounding document or question, derive 3 distinct, non-overlapping positions from the document (typically two contrasting action scopes plus a disciplined status-quo/defer option as Position C).
4. **Debate Directory:** Defaults to `docs/brainstorming/debate/` unless the user specifies another directory.

## 2. Directory Layout & Isolation Rules

```text
<debate-dir>/
├── brief.md                 # Written by orchestrator in Step 0
├── cruxes.md                # Written by orchestrator at the Gate
├── synthesis.md             # Written by orchestrator in Final Synthesis
├── agent-a/
│   ├── 01-opening.md        # Step 1 (≤700 words)
│   ├── 02-rebuttal.md       # Step 2 (≤400 words per rival)
│   └── 03-closing.md        # Step 3 (≤300 words, only if cruxes exist)
├── agent-b/
│   └── ...
└── agent-c/
    └── ...
```

- **Strict Write Isolation:** Each subagent writes **only** inside its own `agent-<id>/` folder. The orchestrator writes `brief.md`, `cruxes.md`, and `synthesis.md`.
- **Strict Read Isolation:**
  - **Step 1 (Openings):** Subagents `A`, `B`, and `C` are completely blind to one another. They read `brief.md`, the grounding docs, and relevant repository files.
  - **Step 2 (Rebuttals):** Each subagent reads **only** `brief.md` and the other two agents' `01-opening.md` files (never another agent's `02-rebuttal.md`).
  - **Step 3 (Closings):** Each subagent reads `cruxes.md` (and prior openings/rebuttals as needed).

## 3. Execution Protocol

### Step 0 — Brief (`brief.md`)
Read the grounding document(s) and inspect the relevant codebase files. Write `<debate-dir>/brief.md` containing:
1. **Decision to be Decided:** Clear statement of the question and concrete definitions of Positions `A`, `B`, and `C`.
2. **Weighted Evaluation Criteria:** 4–6 criteria with percentage weights summing to `100%`. All agents must frame their arguments against these exact criteria.
3. **Hard Constraints:** Non-negotiable technical or architectural invariants any proposal must satisfy.
4. **Shared Context & Precedent:** Relevant files, approximate line counts, existing precedents, and current status quo so all agents start from common facts.

### Step 1 — Openings (`01-opening.md`, ≤700 words)
Spawn 3 subagents (`A`, `B`, `C`) **in parallel**, blind to each other. Record each subagent's `conversationId` (or agent handle) so you can continue the **same** agents in subsequent rounds.

Instruct each subagent (`X` ∈ `{A, B, C}`) to:
- Read `<debate-dir>/brief.md` and the grounding docs/codebase files.
- Write `<debate-dir>/agent-<x>/01-opening.md` (**≤700 words**):
  - **Numbered claims (`X1`, `X2`, …):** Each claim must cite concrete repository evidence (file paths, line numbers, docs) and explicitly state which weighted criterion from `brief.md` it serves.
  - **Known Weaknesses:** A short, honest section identifying the sharpest weaknesses and trade-offs of Position `X`.

Wait for all three openings to complete before starting Step 2.

### Step 2 — Rebuttals (`02-rebuttal.md`, ≤400 words per rival)
Continue the **same** three subagents (`A`, `B`, `C`) in parallel (e.g., via `send_message` to their existing `conversationId`, or by passing their prior context if your harness is stateless).

Instruct each subagent to read **only** the other two agents' `01-opening.md` files and write `<debate-dir>/agent-<x>/02-rebuttal.md` (**≤400 words per rival**, ≤800 words total). For **each** rival (`Y` and `Z`), the rebuttal must include:
1. **Critiques of Specific Claims:** Attack specific claims by ID (`Y1`, `Z2`, etc.) using verifiable codebase or documentation evidence.
2. **Rival's Strongest Point:** Explicitly identify the rival's single strongest argument.
3. **Concessions:** Explicitly concede any rival claim or critique that cannot be refuted with evidence.
4. **Conditions Under Which the Rival Should Win:** State the concrete conditions or roadmap assumptions under which the rival position would be the right choice.

*Constraint:* Do **not** restate the agent's own opening statement.

### Gate — Cruxes (`cruxes.md`)
Read all openings (`01-opening.md`) and rebuttals (`02-rebuttal.md`). Identify the **cruxes**: points that remain **contested, evidence-backed on both sides, and unresolved**.
- Write `<debate-dir>/cruxes.md` numbering each crux (`Crux 1`, `Crux 2`, …), summarizing each position's evidence-backed stance, and stating **"Hinges on: …"** (the core trade-off or technical question that decides the crux).
- **Gate check:** If no genuine cruxes remain after rebuttals, note that in `cruxes.md` and **skip Step 3** directly to Synthesis.

### Step 3 — Closing (`03-closing.md`, ≤300 words; only if cruxes exist)
Continue the **same** three subagents (`A`, `B`, `C`) in parallel. Instruct each to read `<debate-dir>/cruxes.md` and write `<debate-dir>/agent-<x>/03-closing.md` (**≤300 words**):
1. Address **only** the cruxes listed in `cruxes.md`.
2. State a **Final Revised Position**, explicitly noting any changed views, concessions, or narrowed scope resulting from the debate.

*Hard stop:* Run **no further rounds** beyond Step 3.

### Step 4 — Synthesis (`synthesis.md`)
Write `<debate-dir>/synthesis.md` containing:
1. **Points of Agreement:** Claims and constraints all agents converged on or conceded.
2. **Crux Analysis:** Each crux from `cruxes.md`, what it hinges on, and how the evidence resolves it.
3. **Conditional Winners:** Under which concrete conditions Position A, Position B, or Position C is the right choice.
4. **Recommendation:** A clear final recommendation tied directly to the weighted criteria in `brief.md`.

*Rules for Synthesis:*
- Do **not** ask the debater subagents to judge the outcome.
- Do **not** decide by counting the number of arguments; weight verifiable evidence and concessions against `brief.md`'s criteria.
