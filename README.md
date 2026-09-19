# Algorithm Visualizer

Interactive, step-by-step visualizations for **every solution** in
[java-leetcode-solutions](https://github.com/ValentinoFilipetto/java-leetcode-solutions) —
96 problems, 187 worked examples, ~2,200 recorded algorithm steps.

Pick a problem, press play (or tap `→`), and watch the Java source execute line by line next to a
live picture of the data structures: arrays with pointers, sliding windows, linked lists, trees,
graphs, grids, heaps, tries, stacks and intervals. Every step is a full snapshot, so you can scrub
**backwards and forwards** freely.

```
npm install
npm run extract     # read the Java repo -> src/data/solutions.generated.json
npm run dev         # http://localhost:5173
```

## What you get per problem

| | |
|---|---|
| **Java source** | the real file from the solutions repo, syntax highlighted, with the executing line(s) lit up |
| **Visualization** | the data structures as they are at this instant, colour-coded by role |
| **Variables** | the loop variables and accumulators at this step |
| **Explanation** | one sentence about *why* this step happens, not just what it does |
| **Player** | play/pause, step, jump to start/end, scrub, 0.5×–8× speed, keyboard shortcuts |
| **Examples** | most problems ship 2–3 inputs, including the interesting failure cases |

Keyboard: `←` `→` step · `space` play/pause · `Home`/`End` jump · `R` restart · `/` search.

## How it works

The app never runs Java. Each solution has a **tracer** — a TypeScript replay of the same algorithm
that records what the Java code does, step by step:

```
src/
  data/solutions.generated.json   generated from the Java repo (committed, so the app is standalone)
  tracers/                        one file per pattern, 96 tracers + a shared helper layer
  trace/recorder.ts               collects steps, resolves Java source lines by content
  components/viz/                 the renderers: arrays, bars, grids, lists, trees, graphs, heaps…
  types.ts                        the vocabulary shared by tracers and renderers
scripts/
  extract-solutions.mjs           parses the Java sources into solutions.generated.json
  check-tracers.ts                replays every tracer and fails on drift
```

A tracer points at Java lines by quoting a **snippet of the line**, not a line number:

```ts
r.step({
  at: 'if (complementToIndex.containsKey(complement))',
  explain: `${complement} is already in the map at index ${index} — that pair sums to ${target}.`,
  vars: { i, complement, index },
  visuals: [arr(nums, { states, pointers }), mapOf('complementToIndex', seen)],
});
```

So when the Java repository changes, nothing silently breaks: `npm run check` replays all 187
examples and fails loudly if a quoted line no longer exists, if a tracer throws, or if a solution
has no tracer at all.

```
npm run check       # 96/96 solutions traced · 187 examples · 2170 steps total
npm run typecheck
npm run build
```

## Pointing it at your own checkout

`npm run extract` looks for `../java-leetcode-solutions` by default:

```
node scripts/extract-solutions.mjs /path/to/java-leetcode-solutions
```

Problem titles, LeetCode slugs and problem numbers live in `scripts/meta-overrides.json`, because
class names do not always match the LeetCode title. A few of the linked problems are LeetCode
Premium.

## Deploying

The build is a static bundle — any static host works.

```
BASE_PATH=/leetcode-visualizer/ npm run build   # for a GitHub Pages project site
```

A GitHub Actions workflow for Pages is included in `.github/workflows/deploy.yml`: enable Pages with
"GitHub Actions" as the source and pushes to `main` publish automatically.

## Adding a problem

See [CONTRIBUTING.md](./CONTRIBUTING.md) — a new solution in the Java repo needs `npm run extract`
plus one tracer, and `npm run check` tells you exactly what is missing.

## Licence

MIT.
