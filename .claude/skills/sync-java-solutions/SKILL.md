---
name: sync-java-solutions
description: Pull the latest java-leetcode-solutions repo, find solutions that are new (no tracer yet) or drifted (Java changed shape), write or fix their tracers per CONTRIBUTING.md, verify them in the browser, and commit + push. Use when asked to sync with the Java repo, pick up new solutions, or add visualizations for something just pushed upstream.
---

# Sync new Java solutions into the visualizer

The Java repo (`../java-leetcode-solutions`, sibling checkout) is upstream. Sources live under
`src/main/java/leetcode/solutions/<difficulty>/<category>/<ClassName>.java`; the solution id used
everywhere here is `<difficulty>/<category>/<ClassName>`.

Before writing any tracer, read [CONTRIBUTING.md](../../../CONTRIBUTING.md) (tracer shape, rules of
thumb, visual building blocks) and [AGENTS.md](../../../AGENTS.md) (verification + commit rules).
This skill is the end-to-end loop around them; those files win if anything here disagrees.

## 1. Fetch upstream

```
git -C ../java-leetcode-solutions pull
git -C ../java-leetcode-solutions log --oneline -10
```

Note which commits are new — their messages ("Add NQueens solutions", "Improve matchsticks to square
solution") tell you which solutions were added vs. changed.

## 2. Re-extract and find the work

```
pnpm run extract
pnpm run check
```

`check` output gives the two work lists:

- **`No tracer yet (N):`** — brand-new solutions → step 3a.
- **Unresolved `at` snippets / tracer throws** — drift on an existing solution → step 3b.

If both lists are empty, report that there is nothing to sync and stop.

## 3a. New solution

For each missing id:

1. **Metadata.** Add an entry to `scripts/meta-overrides.json` next to related ids (the file is
   only loosely ordered, so don't re-sort it), in the same shape as its neighbours:
   ```json
   "hard/backtracking/NQueens": {
     "title": "N-Queens",
     "slug": "n-queens",
     "number": 51
   }
   ```
   Edit it with the Edit tool rather than a script. With `core.autocrlf` on, inserting LF lines into
   the CRLF working copy produces mixed line endings that git commits un-normalized, and the diff
   balloons to the whole file. Check `git diff --cached --stat` shows only your added lines.
   Use the official LeetCode title, slug, and problem number. Re-run `pnpm run extract`.
2. **Read the Java source** in full (`src/data/solutions.generated.json` has it, or read the `.java`
   file directly). Understand the exact control flow, including early returns and quirks.
3. **Pick the file.** Add the tracer to the `src/tracers/<pattern>.ts` that matches the category
   (`backtracking.ts`, `graphs.ts`, …). Look at a similar existing tracer in that file and match its
   style. Only create a new file if no existing one fits — then also register its map in
   `src/tracers/index.ts`.
4. **Write the tracer** following CONTRIBUTING.md:
   - `at` quotes a Java line snippet (`'snippet@2'` for the 2nd occurrence), never a line number.
   - Mirror the Java control flow exactly.
   - `explain` says *why*, not what.
   - Every `r.step()` gets fresh visuals — copy arrays/maps, never mutate a pushed snapshot.
   - 2–3 examples with small inputs (4–10 elements) covering the interesting cases.
   - Choose visuals from `src/tracers/helpers.ts` (`arr`, `grid`, `mapOf`, `stack`, `frames`,
     `tree`, `decisionTree`, `graphViz`, …). Backtracking problems use `decisionTree` — see the
     existing ones in `backtracking.ts`. Keep cell-state meanings consistent with other tracers.

## 3b. Drifted solution

Open the tracer and the new Java source side by side. Update the `at` snippets to the new lines,
and if the algorithm itself changed shape, update the replay logic so it still mirrors the Java
code step for step. Don't just patch snippets to make `check` pass if the logic no longer matches.

## 4. Verify (pre-approved, don't ask)

Run in order, fixing and re-running until all are clean:

```
pnpm run typecheck
pnpm run check
pnpm run verify <id> [<id> ...]     # every id you added or touched; not --all
```

Use `verify --all` only if you changed a shared helper, `VisualView`, or a viz component.

If something can't be made to pass (genuine ambiguity in the Java, or a viz-component limitation),
**stop and ask the user** instead of committing.

## 5. Commit and push (pre-approved, don't ask)

Once all three pass, commit to `main` and push. Stage only the files you changed
(`src/tracers/*`, `src/data/solutions.generated.json`, `scripts/meta-overrides.json`, any viz fix).
Match the existing message style, e.g.:

- `Decision tree for N-Queens` / `Visualization for Combinations` — one new solution
- `Sync with the Java repo: add 3 new solutions` — several
- `Sync with the Java repo: fix 2 drifted tracers, add 1 new solution` — mixed

One commit per sync is fine; split only if the changes are unrelated.

## 6. Report

Tell the user which solutions were added or fixed, which examples each has, and the commit hash
that was pushed. Mention anything skipped and why.
