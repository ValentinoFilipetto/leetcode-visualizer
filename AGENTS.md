# Instructions for coding agents

This file is for AI agents (Claude Code and similar) working in this repo. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for how visualizations are built; this file covers the
workflow around that: how to verify one, and what to do once it passes.

## When you add or change a visualization

A "visualization" here means anything under `src/tracers/` (a new tracer, an edited tracer to fix
drift from the Java repo, new examples on an existing tracer) or the generated data it depends on
(`src/data/solutions.generated.json`, `scripts/meta-overrides.json`).

Do all of the following, in order, without asking the user for permission first — this loop is
pre-approved:

1. **`pnpm run typecheck`** — must be clean.
2. **`pnpm run check`** — replays every tracer's example data. Fails on an unresolved `at` snippet,
   a tracer that throws, or a solution missing a tracer entirely. This only replays the *data*; it
   never renders a React component, so it cannot catch a broken visual.
3. **`pnpm run verify <solutionId> [<solutionId> ...]`** — the browser-level check. It boots the
   real Vite dev server, drives the real app in headless Chrome via Puppeteer, and steps through
   every example of each solution you pass it end to end, watching for:
   - uncaught exceptions and `console.error` calls from React or a `VisualView` renderer
   - a tracer that threw mid-replay (surfaces as a normal-looking "This trace stopped early: …"
     step rather than a crash — `pnpm run check` catches this too, but confirming it in the actual
     rendered page is the point of this step)
   - a solution with no tracer registered at all

   Pass only the solution id(s) you touched (e.g. `medium/backtracking/MatchsticksToSquare`), not
   `--all` — the full suite takes long enough that it isn't worth running on every change. Run
   `--all` only if you suspect a shared helper (`src/tracers/helpers.ts`, `VisualView`, a viz
   component) broke something across many solutions at once.
4. If step 3 fails, fix the tracer (or the underlying viz component, if the bug is there) and
   re-run steps 2 and 3 until it passes. Do not commit a visualization that hasn't passed
   `pnpm run verify`.
5. Once typecheck, check, and verify all pass: **commit and push to `main` without asking**. Use a
   short, imperative commit message describing the solution added or fixed (see recent history for
   the style — e.g. "Decision tree for Permutations II", "Sync with the Java repo: fix N drifted
   tracers"). This repo has no CI gate and no review step; verify passing *is* the gate.

If any of the three checks can't be made to pass (e.g. a genuine ambiguity in what the Java code is
doing, or a viz component limitation), stop and ask rather than committing something broken.

## Why this exists

`pnpm run check` was, for a while, the only automated check — it validates against the extracted
Java source text, not against what actually renders. That gap is real: a viz object can be
well-formed enough to pass `check` and still crash `VisualView`, or render something nonsensical,
without either showing up until a human opens the page. `pnpm run verify` closes that gap, which is
what makes "commit and push without asking" safe to do routinely instead of requiring a human to
eyeball every new visualization in a browser first.

## Everyday sync workflow

The Java repo (`../java-leetcode-solutions` as a sibling checkout) is upstream of this one. When
asked to sync or to add a visualization for something just pushed there:

1. `git -C ../java-leetcode-solutions pull` to get the latest source.
2. `pnpm run extract` to regenerate `src/data/solutions.generated.json`.
3. If it's a brand-new solution, add its LeetCode `slug`/`number` to `scripts/meta-overrides.json`
   (re-run `extract` after) and write a new tracer per CONTRIBUTING.md.
   If it's drift on an existing solution (the Java code changed shape), `pnpm run check` will list
   the tracer's now-unresolved `at` snippets — fix them to match the new source lines.
4. Run the four checks above, then commit and push per the rule above.
