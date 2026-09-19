# Adding a visualization

Every solution in the Java repository needs one **tracer**: a TypeScript replay of the algorithm
that records a snapshot per step. `npm run check` lists the solutions that do not have one yet.

## 1. Re-extract the sources

```
npm run extract
```

This rewrites `src/data/solutions.generated.json` from the Java repo (difficulty, pattern,
complexities from the Javadoc header, and the full source text).

## 2. Write the tracer

Tracers live in `src/tracers/`, grouped by pattern (`stack.ts`, `graphs.ts`, …). Each file exports a
map keyed by solution id — `difficulty/category/ClassName`, exactly as it appears in the generated
JSON.

```ts
function twoSum(r: Recorder, nums: number[], target: number) {
  const seen = new Map<number, number>();

  r.step({
    at: 'Map<Integer, Integer> complementToIndex',   // a snippet of the Java line
    explain: 'Walk the array once, remembering every value we have already seen.',
    vars: { target },
    visuals: [arr(nums, { title: 'nums' }), mapOf('complementToIndex', seen)],
  });
  // … one r.step() per interesting moment …
}

export const hashingTracers: Record<string, Tracer> = {
  'easy/hashing/TwoSum': {
    examples: [
      {
        label: 'nums = [2,7,11,15], target = 9',
        input: 'nums = [2, 7, 11, 15], target = 9',
        run: (r) => twoSum(r, [2, 7, 11, 15], 9),
      },
    ],
  },
};
```

Then add the map to `src/tracers/index.ts`.

### Rules of thumb

- **`at` quotes the Java line, never a line number.** Use `'snippet@2'` for the second occurrence.
  A snippet that stops matching fails `npm run check` instead of silently losing the highlight.
- **Mirror the Java control flow**, including its early returns and its quirks. The visualization is
  only useful if it is the same algorithm.
- **`explain` says why, not what.** The code is already on screen; the sentence should carry the
  insight ("marking the cell doubles as the visited flag").
- **Each step is a complete snapshot** — build fresh visuals, never mutate one already pushed, or
  stepping backwards will show the wrong state.
- **Keep inputs small**: 4–10 elements, and 2–3 examples covering the interesting cases (found /
  not found, duplicates, empty).

### Visual building blocks

`src/tracers/helpers.ts` wraps the renderers: `arr`, `bars`, `grid`, `mapOf`, `setOf`, `stack`,
`queue`, `frames` (call stack), `chips`, `heap`, `intervalsViz`, `tree`, `listViz`, `graphViz`.
Cell states (`active`, `compare`, `window`, `visited`, `done`, `success`, `error`, `muted`) carry
the colour language across every problem, so keep their meaning consistent.

## 3. Check

```
npm run check       # replays every example, reports unresolved snippets and missing tracers
npm run typecheck
```
