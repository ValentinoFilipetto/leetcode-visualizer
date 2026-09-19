/**
 * Replays every tracer against the extracted Java sources.
 *
 * Fails when a tracer throws, produces no steps, or refers to a code snippet
 * that no longer exists in the Java file (which would silently drop the line
 * highlighting). Also reports solutions that still have no tracer at all.
 *
 *   npm run check
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Recorder } from '../src/trace/recorder';
import { tracers } from '../src/tracers';
import type { Solution, Step } from '../src/types';

/**
 * Steps must be independent snapshots. Tracers mirror Java code that mutates in
 * place, so an array handed to two different steps means both render whatever
 * the array ends up holding — the earlier step silently shows the final state.
 * Returns the paths of arrays reachable from more than one step.
 */
function sharedArrays(steps: Step[]): string[] {
  const owner = new Map<object, number>();
  const shared = new Set<string>();

  const walk = (value: unknown, stepIndex: number, path: string) => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      const seenAt = owner.get(value);
      if (seenAt !== undefined && seenAt !== stepIndex) {
        shared.add(path);
        return;
      }
      owner.set(value, stepIndex);
      value.forEach((item, i) => walk(item, stepIndex, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(value)) walk(v, stepIndex, `${path}.${k}`);
  };

  steps.forEach((step, i) => walk(step.visuals, i, 'visuals'));
  return [...shared];
}

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'solutions.generated.json'), 'utf8')) as {
  solutions: Solution[];
};

let failures = 0;
let exampleCount = 0;
let stepCount = 0;
const missing: string[] = [];

for (const solution of data.solutions) {
  const tracer = tracers[solution.id];
  if (!tracer) {
    missing.push(solution.id);
    continue;
  }
  if (tracer.examples.length === 0) {
    console.error(`✕ ${solution.id}: tracer has no examples`);
    failures++;
    continue;
  }

  for (const example of tracer.examples) {
    exampleCount++;
    const recorder = new Recorder(solution.code);
    try {
      example.run(recorder);
    } catch (err) {
      console.error(`✕ ${solution.id} [${example.label}] threw: ${(err as Error).stack}`);
      failures++;
      continue;
    }
    stepCount += recorder.steps.length;

    if (recorder.steps.length === 0) {
      console.error(`✕ ${solution.id} [${example.label}] produced no steps`);
      failures++;
    }
    if (recorder.unresolved.length) {
      const unique = [...new Set(recorder.unresolved)];
      console.error(`✕ ${solution.id} [${example.label}] unknown code snippets: ${unique.map((s) => JSON.stringify(s)).join(', ')}`);
      failures++;
    }
    const noVisuals = recorder.steps.filter((s) => s.visuals.length === 0).length;
    if (noVisuals === recorder.steps.length) {
      console.error(`✕ ${solution.id} [${example.label}] has no visuals on any step`);
      failures++;
    }
    if (recorder.ambiguous.length) {
      const unique = new Map(recorder.ambiguous.map((a) => [a.snippet, a.lines]));
      for (const [snippet, lineNumbers] of unique) {
        console.error(
          `✕ ${solution.id} [${example.label}] ${JSON.stringify(snippet)} matches lines ${lineNumbers.join(', ')} — it silently resolves to ${lineNumbers[0]}. Add "@n" or quote more of the line.`,
        );
        failures++;
      }
    }
    const shared = sharedArrays(recorder.steps);
    if (shared.length) {
      console.error(
        `✕ ${solution.id} [${example.label}] steps share mutable arrays (stepping back would show the wrong state): ${shared.slice(0, 5).join(', ')}`,
      );
      failures++;
    }
    const noLines = recorder.steps.filter((s) => s.lines.length === 0).length;
    if (noLines > recorder.steps.length / 2) {
      console.error(`✕ ${solution.id} [${example.label}] ${noLines}/${recorder.steps.length} steps highlight no source line`);
      failures++;
    }
  }
}

const traced = data.solutions.length - missing.length;
console.log(
  `\n${traced}/${data.solutions.length} solutions traced · ${exampleCount} examples · ${stepCount} steps total`,
);

if (missing.length) {
  console.log(`\nNo tracer yet (${missing.length}):`);
  for (const id of missing) console.log(`  · ${id}`);
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log('\nAll tracers replay cleanly.');
if (process.env.REQUIRE_FULL_COVERAGE && missing.length) process.exit(1);
