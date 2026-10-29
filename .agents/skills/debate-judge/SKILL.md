---
name: debate-judge
description: >-
  Acts as an independent blind judge for a completed multi-agent debate by
  reading the debate artifacts, verifying factual claims against the codebase
  and documentation, scoring options against the brief's weighted criteria,
  ruling on cruxes, and writing a synthesis to judges/judge-N/synthesis.md.
  Use when the user asks to judge, evaluate, or audit a completed debate.
---

# Independent Debate Judge

Evaluates a completed multi-agent debate independently, verifying claims directly against the repository's source code and documentation rather than relying on rhetorical confidence.

## 1. Strict Information Isolation

To ensure your judgment is genuinely independent:

- **Debate Directory:** Defaults to `docs/brainstorming/debate/` unless specified by the user.
- **Read ONLY:**
  - `<debate-dir>/brief.md`
  - `<debate-dir>/cruxes.md`
  - `<debate-dir>/agent-a/*`, `<debate-dir>/agent-b/*`, `<debate-dir>/agent-c/*` (all rounds: `01-opening.md`, `02-rebuttal.md`, `03-closing.md`)
  - Codebase files and documentation cited by the agents or needed to verify their claims.
- **Do NOT Read:**
  - `<debate-dir>/synthesis.md` (the orchestrator's synthesis)
  - `<debate-dir>/orchestrator/` (if present)
  - Any existing `<debate-dir>/judges/*` directory
- **Write ONLY to:** `<debate-dir>/judges/judge-N/synthesis.md`.
  - If the user did not specify `N`, atomically claim the next available `judge-N` directory without reading any existing judge directories:
    ```sh
    mkdir -p "<debate-dir>/judges"
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if mkdir "<debate-dir>/judges/judge-$i" 2>/dev/null; then
        echo "Claimed judge-$i"
        break
      fi
    done
    ```

## 2. How to Judge

1. **Use the Brief's Criteria and Weights as the Standard:**
   Score every option strictly against the criteria and weights defined in `brief.md`. Do not introduce new criteria into the scoring table. If you believe an important criterion was omitted, note it separately outside the table.
2. **Track Every Numbered Claim (`A1`, `B2`, `C1`, …) to Its Fate:**
   Classify each claim as *upheld*, *refuted*, *partially refuted*, *conceded*, or *never addressed*.
   - A claim that went unaddressed is **not** a refuted claim.
   - A rebuttal that merely asserts the opposite without evidence is **not** a refutation.
3. **Check Evidence Quality Against the Codebase and Docs:**
   Whenever a claim makes a verifiable assertion about the codebase or documentation (file imports, line counts, AST/build behavior, architectural rules, test behavior, or roadmap docs), inspect the actual files in the repository and record what you found. Flag claims resting on unsupported assertions or misread code.
4. **Discount Rhetorical Strength; Weight Concessions and Weaknesses:**
   Confident or longer arguments are not stronger arguments. An agent's concessions in rebuttals/closings count against its original position, and its self-assessed "Known Weaknesses" are direct evidence.
5. **Rule on Every Crux:**
   Rule explicitly on each crux in `cruxes.md`, and add a ruling for any decisive crux that the orchestrator missed.

## 3. Required Output Format & Word Limit

Write `<debate-dir>/judges/judge-N/synthesis.md` using **these exact markdown headings** and keeping the entire file **under 1,200 words** (verify with `wc -w <debate-dir>/judges/judge-N/synthesis.md`):

```markdown
## Verdict
One paragraph: recommended option, confidence (low/medium/high), and the single biggest reason.

## Criteria scoring
Table: criterion | weight | A | B | C | note. Scores 1–5 (include a weighted total row).

## Claim ledger
Table: claim ID | status | evidence quality (strong/weak/unverified) | note. Include only claims that affected your verdict.

## Crux rulings
For each crux: what it hinges on, your ruling, and why (include any crux missed by cruxes.md).

## Conditional recommendations
Under which conditions each option would be the right choice.

## What would change my verdict
Specific facts or findings that would flip the recommendation.

## Missed by the debate
Anything important none of the agents raised (keep this short).
```
