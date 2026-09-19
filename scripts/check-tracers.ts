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
import type { Solution } from '../src/types';

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
