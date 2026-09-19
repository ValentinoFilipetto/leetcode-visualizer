/**
 * Reads the Java solutions repository and emits src/data/solutions.generated.json,
 * so the web app is self-contained and can be deployed without the Java sources.
 *
 * Usage: node scripts/extract-solutions.mjs [path-to-java-repo]
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const javaRepo = process.argv[2] ?? join(repoRoot, '..', 'java-leetcode-solutions');
const srcRoot = join(javaRepo, 'src', 'main', 'java', 'leetcode', 'solutions');

if (!existsSync(srcRoot)) {
  console.error(`Cannot find Java solutions at ${srcRoot}.`);
  console.error('Pass the path to the java-leetcode-solutions checkout as the first argument.');
  process.exit(1);
}

const overrides = JSON.parse(readFileSync(join(here, 'meta-overrides.json'), 'utf8'));

const CATEGORY_LABELS = {
  arrays: 'Arrays',
  backtracking: 'Backtracking',
  binarysearch: 'Binary Search',
  bitmanipulation: 'Bit Manipulation',
  dynamicprogramming: 'Dynamic Programming',
  graphs: 'Graphs',
  greedy: 'Greedy',
  hashing: 'Hashing',
  heaps: 'Heaps',
  intervals: 'Intervals',
  linkedlist: 'Linked List',
  linkedlists: 'Linked List',
  math: 'Math',
  slidingwindow: 'Sliding Window',
  sorting: 'Sorting',
  stack: 'Stack',
  tree: 'Trees',
  trees: 'Trees',
  tries: 'Tries',
  twopointers: 'Two Pointers',
  various: 'Various',
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.java')) out.push(full);
  }
  return out;
}

/** "LongestSubstringWithoutRepeatingCharacters" -> "Longest Substring Without Repeating Characters" */
function titleize(className) {
  return className
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

function parseDoc(code) {
  const doc = code.match(/\/\*\*([\s\S]*?)\*\//);
  const meta = {};
  if (doc) {
    for (const raw of doc[1].split('\n')) {
      const line = raw.replace(/^\s*\*\s?/, '').trim();
      const m = line.match(/^(Pattern|Time complexity|Space complexity)\s*:\s*(.+?)\s*$/i);
      if (m) meta[m[1].toLowerCase().replace(' ', '_')] = m[2].replace(/\*\/$/, '').trim();
    }
  }
  return meta;
}

/** Path separator on both POSIX and Windows. */
const SEP = /[\\/]/;

const files = walk(srcRoot)
  .filter((f) => {
    const rel = relative(srcRoot, f).split(SEP);
    return rel[0] !== 'types' && rel[rel.length - 1] !== 'Main.java';
  })
  .sort();

const solutions = files.map((file) => {
  const rel = relative(srcRoot, file).split(SEP);
  const difficulty = rel[0];
  const category = rel.length > 2 ? rel[1] : 'various';
  const className = rel[rel.length - 1].replace(/\.java$/, '');
  const id = `${difficulty}/${category}/${className}`;
  const code = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const doc = parseDoc(code);
  const o = overrides[id] ?? {};
  const title = o.title ?? titleize(className);
  return {
    id,
    className,
    title,
    difficulty,
    category,
    categoryLabel: CATEGORY_LABELS[category] ?? titleize(category),
    pattern: doc.pattern ?? CATEGORY_LABELS[category] ?? '',
    time: doc.time_complexity ?? '',
    space: doc.space_complexity ?? '',
    leetcodeSlug: o.slug ?? null,
    leetcodeNumber: o.number ?? null,
    sourcePath: `src/main/java/leetcode/solutions/${rel.join('/')}`,
    code,
  };
});

const outFile = join(repoRoot, 'src', 'data', 'solutions.generated.json');
writeFileSync(outFile, JSON.stringify({ generatedAt: null, solutions }, null, 2) + '\n');

const byDifficulty = solutions.reduce((acc, s) => ({ ...acc, [s.difficulty]: (acc[s.difficulty] ?? 0) + 1 }), {});
console.log(`Extracted ${solutions.length} solutions ->  src/data/solutions.generated.json`);
console.log(Object.entries(byDifficulty).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
const missingSlug = solutions.filter((s) => !s.leetcodeSlug).length;
if (missingSlug) console.log(`  (${missingSlug} without an explicit LeetCode slug; they fall back to search links)`);
