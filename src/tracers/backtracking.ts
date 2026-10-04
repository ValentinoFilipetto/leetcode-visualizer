import type { Recorder } from '../trace/recorder';
import type { CellState, DecisionTreeNodeViz, TextViz, Tracer, Visual } from '../types';
import { arr, chars, chips, decisionTree, frames, grid, list, mapOf, setOf } from './helpers';

/** Results panel: every finished branch, with the newest one highlighted. */
function resultsViz(title: string, items: string[]): TextViz {
  return {
    ...chips(title, items, { emptyHint: '[]' }),
    lines: items.map((text, i) => ({ text, state: i === items.length - 1 ? ('success' as CellState) : undefined })),
  };
}

/* ── Subsets ──────────────────────────────────────────────────────────────── */

function subsets(r: Recorder, nums: number[]) {
  const res: number[][] = [];
  const subset: number[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `ss${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (take nums[i] then leave it out, per node)' }),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'dfs(nums, 0, new ArrayList<>(), res);',
    explain: 'Each element has exactly two fates: taken or left out. Walking that binary decision tree yields all 2ⁿ subsets — one leaf per subset.',
    visuals: view(),
  });

  const dfs = (i: number, node: DecisionTreeNodeViz) => {
    if (i === nums.length) {
      res.push(subset.slice());
      node.label = `[${subset.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: ['if (i == nums.length) {', 'res.add(new ArrayList<>(subset));'],
        explain: `Every element has been decided — record a copy of [${subset.join(', ')}]. The copy matters: the list itself keeps mutating.`,
        vars: { i, subset: list(subset) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }

    subset.push(nums[i]);
    const takeNode = mkNode(`[${subset.join(',')}]`, `+${nums[i]}`);
    takeNode.state = 'active';
    node.children!.push(takeNode);
    r.step({
      at: ['subset.add(nums[i]);', 'dfs(nums, i + 1, subset, res);@1'],
      explain: `Branch 1 — take ${nums[i]}.`,
      vars: { i, 'nums[i]': nums[i], subset: list(subset) },
      visuals: view(),
    });
    dfs(i + 1, takeNode);
    if (takeNode.state === 'active') takeNode.state = 'done';
    subset.pop();

    const skipNode = mkNode(`[${subset.join(',')}]`, `skip ${nums[i]}`);
    skipNode.state = 'active';
    node.children!.push(skipNode);
    r.step({
      at: 'subset.remove(subset.size() - 1);',
      explain: `Both descendants of taking ${nums[i]} are explored — undo the choice, then also try leaving ${nums[i]} out entirely.`,
      vars: { i, subset: list(subset) },
      visuals: view(),
      tone: 'warn',
    });
    r.step({
      at: 'dfs(nums, i + 1, subset, res);@2',
      explain: `Branch 2 — leave ${nums[i]} out.`,
      vars: { i, 'nums[i]': nums[i], subset: list(subset) },
      visuals: view(),
    });
    dfs(i + 1, skipNode);
    if (skipNode.state === 'active') skipNode.state = 'done';
  };

  dfs(0, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} subsets = 2^${nums.length}.`,
    visuals: view(),
    tone: 'success',
    result: `return ${res.length} subsets`,
  });
}

/* ── Subsets II ───────────────────────────────────────────────────────────── */

function subsetsII(r: Recorder, input: number[]) {
  const nums = input.slice().sort((a, b) => a - b);
  const res: number[][] = [];
  const subset: number[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `ss2_${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (duplicates skipped together, so no subset repeats)' }),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'Arrays.sort(nums);',
    explain: `Sorting groups duplicates together: ${list(input)} → ${list(nums)}. That is what makes skipping them possible.`,
    visuals: view(),
  });

  const dfs = (i: number, node: DecisionTreeNodeViz) => {
    if (i === nums.length) {
      res.push(subset.slice());
      node.label = `[${subset.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: 'res.add(new ArrayList<>(subset));',
        explain: `Record [${subset.join(', ')}].`,
        vars: { i, subset: list(subset) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }

    subset.push(nums[i]);
    const takeNode = mkNode(`[${subset.join(',')}]`, `+${nums[i]}`);
    takeNode.state = 'active';
    node.children!.push(takeNode);
    r.step({
      at: ['subset.add(nums[i]);', 'dfs(nums, i + 1, subset);@1'],
      explain: `Take ${nums[i]} and continue.`,
      vars: { i, subset: list(subset) },
      visuals: view(),
    });
    dfs(i + 1, takeNode);
    if (takeNode.state === 'active') takeNode.state = 'done';
    subset.pop();

    let j = i;
    while (j + 1 < nums.length && nums[j] === nums[j + 1]) j++;
    if (j !== i) {
      r.step({
        at: 'while (i + 1 < nums.length && nums[i] == nums[i + 1]) i++;',
        explain: `Before the "skip" branch, jump past the copies of ${nums[i]} (indices ${i}…${j}). Skipping one copy but not the others would produce the same subset twice.`,
        vars: { i: j, value: nums[i] },
        visuals: view(),
        tone: 'warn',
      });
    }

    const skipNode = mkNode(`[${subset.join(',')}]`, j !== i ? `skip ${nums[i]} ×${j - i + 1}` : `skip ${nums[i]}`);
    skipNode.state = 'active';
    node.children!.push(skipNode);
    r.step({
      at: 'dfs(nums, i + 1, subset);@2',
      explain: `Skip branch — continue without ${nums[i]}.`,
      vars: { i: j, subset: list(subset) },
      visuals: view(),
    });
    dfs(j + 1, skipNode);
    if (skipNode.state === 'active') skipNode.state = 'done';
  };

  dfs(0, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} distinct subsets, each produced exactly once.`,
    visuals: view(),
    tone: 'success',
    result: `return ${res.map((s) => `[${s.join(',')}]`).join(', ')}`,
  });
}

/* ── Combination Sum ──────────────────────────────────────────────────────── */

function combinationSum(r: Recorder, nums: number[], target: number) {
  const res: number[][] = [];
  const combination: number[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `cs${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (take nums[i] then skip nums[i], per node)' }),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'dfs(nums, 0, target, 0, new ArrayList<>());',
    explain:
      'Each candidate may be reused, so "take" keeps the same index i while "skip" advances to i + 1. Every recursive call becomes one node below: the tree is a direct picture of the search.',
    vars: { target },
    visuals: view(),
  });

  const dfs = (i: number, sum: number, node: DecisionTreeNodeViz) => {
    if (sum === target) {
      res.push(combination.slice());
      node.label = `[${combination.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: ['if (sum == target) {', 'res.add(new ArrayList<>(combination));'],
        explain: `[${combination.join(', ')}] sums to ${target} exactly.`,
        vars: { sum, target, combination: list(combination) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }
    if (i === nums.length || sum > target) {
      node.label = `[${combination.join(',')}] ✗`;
      node.state = 'error';
      r.step({
        at: 'if (i == nums.length || sum > target) return;',
        explain: sum > target ? `The sum ${sum} already overshoots ${target} — prune this branch.` : 'No candidates left to try.',
        vars: { i, sum, target },
        visuals: view(),
        tone: 'warn',
      });
      return;
    }

    combination.push(nums[i]);
    const takeNode = mkNode(`[${combination.join(',')}]`, `+${nums[i]}`);
    takeNode.state = 'active';
    node.children!.push(takeNode);
    r.step({
      at: ['combination.add(nums[i]);', 'dfs(nums, i, target, sum + nums[i], combination);'],
      explain: `Option 1 — take ${nums[i]} and stay at index ${i}, so it can be taken again.`,
      vars: { i, 'nums[i]': nums[i], sum: sum + nums[i] },
      visuals: view(),
    });
    dfs(i, sum + nums[i], takeNode);
    if (takeNode.state === 'active') takeNode.state = 'done';
    combination.pop();

    const skipNode = mkNode(`[${combination.join(',')}]`, `skip ${nums[i]}`);
    skipNode.state = 'active';
    node.children!.push(skipNode);
    r.step({
      at: ['combination.remove(combination.size() - 1);', 'dfs(nums, i + 1,target, sum, combination);'],
      explain: `Option 2 — never use ${nums[i]} again in this branch.`,
      vars: { i, 'nums[i]': nums[i], sum },
      visuals: view(),
    });
    dfs(i + 1, sum, skipNode);
    if (skipNode.state === 'active') skipNode.state = 'done';
  };

  dfs(0, 0, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} combination(s) reach ${target}.`,
    visuals: view(),
    tone: 'success',
    result: `return [${res.map((s) => `[${s.join(',')}]`).join(', ')}]`,
  });
}

/* ── Combination Sum II ───────────────────────────────────────────────────── */

function combinationSumII(r: Recorder, input: number[], target: number) {
  const candidates = input.slice().sort((a, b) => a - b);
  const res: number[][] = [];
  const combination: number[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `cs2_${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (each candidate is taken at most once)' }),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'Arrays.sort(candidates);',
    explain: `Each candidate may be used at most once, and duplicates must not produce duplicate combinations. Sorting (${list(candidates)}) makes both easy.`,
    vars: { target },
    visuals: view(),
  });

  const dfs = (i: number, sum: number, node: DecisionTreeNodeViz) => {
    if (sum === target) {
      res.push(combination.slice());
      node.label = `[${combination.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: 'res.add(new ArrayList<>(combination));',
        explain: `[${combination.join(', ')}] hits the target.`,
        vars: { sum, combination: list(combination) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }
    if (i >= candidates.length || sum > target) {
      node.label = `[${combination.join(',')}] ✗`;
      node.state = 'error';
      r.step({
        at: 'if (i >= candidates.length || sum > target) return;',
        explain: sum > target ? `Sum ${sum} exceeds ${target} — prune.` : 'Out of candidates.',
        vars: { i, sum },
        visuals: view(),
        tone: 'warn',
      });
      return;
    }

    combination.push(candidates[i]);
    const takeNode = mkNode(`[${combination.join(',')}]`, `+${candidates[i]}`);
    takeNode.state = 'active';
    node.children!.push(takeNode);
    r.step({
      at: ['combination.add(candidates[i]);', 'dfs(candidates, target, i + 1, combination, sum + candidates[i]);'],
      explain: `Take ${candidates[i]} and move to index ${i + 1} — one use only.`,
      vars: { i, sum: sum + candidates[i] },
      visuals: view(),
    });
    dfs(i + 1, sum + candidates[i], takeNode);
    if (takeNode.state === 'active') takeNode.state = 'done';
    combination.pop();

    let j = i;
    while (j < candidates.length - 1 && candidates[j] === candidates[j + 1]) j++;
    if (j !== i) {
      r.step({
        at: 'while (i <  candidates.length  - 1 && candidates[i] == candidates[i + 1]) i++;',
        explain: `Skip the remaining copies of ${candidates[i]} (up to index ${j}) before the skip branch, otherwise the same combination would be built again with a different copy.`,
        vars: { i: j },
        visuals: view(),
        tone: 'warn',
      });
    }

    const skipNode = mkNode(`[${combination.join(',')}]`, j !== i ? `skip ${candidates[i]} ×${j - i + 1}` : `skip ${candidates[i]}`);
    skipNode.state = 'active';
    node.children!.push(skipNode);
    r.step({
      at: 'dfs(candidates, target, i + 1, combination, sum);',
      explain: `Skip branch — continue after the duplicates.`,
      vars: { i: j + 1, sum },
      visuals: view(),
    });
    dfs(j + 1, sum, skipNode);
    if (skipNode.state === 'active') skipNode.state = 'done';
  };

  dfs(0, 0, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} combination(s), each unique.`,
    visuals: view(),
    tone: 'success',
    result: `return [${res.map((s) => `[${s.join(',')}]`).join(', ')}]`,
  });
}

/* ── Permutations ─────────────────────────────────────────────────────────── */

function permutations(r: Recorder, nums: number[]) {
  const res: number[][] = [];
  const permutation: number[] = [];
  const pick = new Array(nums.length).fill(false);
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `pm${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (one child per still-unused value)' }),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'backtrack(nums, new boolean[nums.length], new ArrayList<>());',
    explain:
      'The boolean array records which values are already in the current permutation, so each node branches into one child per still-unused value — up to n children, not just two.',
    visuals: view(),
  });

  const dfs = (node: DecisionTreeNodeViz) => {
    if (permutation.length === nums.length) {
      res.push(permutation.slice());
      node.label = `[${permutation.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: ['if (perm.size() == nums.length) {', 'res.add(new ArrayList<>(perm));'],
        explain: `All ${nums.length} values are used — [${permutation.join(', ')}] is a complete permutation.`,
        vars: { permutation: list(permutation) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (pick[i]) continue;
      permutation.push(nums[i]);
      pick[i] = true;
      const child = mkNode(`[${permutation.join(',')}]`, `+${nums[i]}`);
      child.state = 'active';
      node.children!.push(child);
      r.step({
        at: ['perm.add(nums[i]);', 'pick[i] = true;'],
        explain: `Place ${nums[i]} at position ${permutation.length - 1}.`,
        vars: { i, permutation: list(permutation) },
        visuals: view(),
      });
      dfs(child);
      if (child.state === 'active') child.state = 'done';
      permutation.pop();
      pick[i] = false;
      r.step({
        at: ['perm.remove(perm.size() - 1);', 'pick[i] = false;'],
        explain: `Backtrack: free ${nums[i]} again so other branches can use it.`,
        vars: { i, permutation: list(permutation) },
        visuals: view(),
        tone: 'warn',
      });
    }
  };

  dfs(root);
  r.step({
    at: 'return res;',
    explain: `${res.length} permutations = ${nums.length}!.`,
    visuals: view(),
    tone: 'success',
    result: `return ${res.length} permutations`,
  });
}

/* ── Permutations II ──────────────────────────────────────────────────────── */

function permutationsUnique(r: Recorder, nums: number[]) {
  const res: number[][] = [];
  const combination: number[] = [];
  const counter = new Map<number, number>();
  for (const num of nums) counter.set(num, (counter.get(num) ?? 0) + 1);
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `pu${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (one child per distinct value still available)' }),
    mapOf('counter  (remaining copies of each number)', counter),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'this.backtrack(new ArrayList<>(), nums.length, counter);',
    explain: `Repeated numbers make identical choices indistinguishable, so branch on distinct values instead of indices: counting how many copies of each number remain, and choosing an entry only decrements its count. Starting counts: ${[...counter].map(([k, v]) => `${k}×${v}`).join(', ')}.`,
    visuals: view(),
  });

  const dfs = (node: DecisionTreeNodeViz) => {
    if (combination.length === nums.length) {
      res.push(combination.slice());
      node.label = `[${combination.join(',')}] ✓`;
      node.state = 'success';
      r.step({
        at: ['if (combination.size() == n) {', 'res.add(new ArrayList<>(combination));'],
        explain: `All ${nums.length} slots are filled — [${combination.join(', ')}] is a complete permutation.`,
        vars: { combination: list(combination) },
        visuals: view(),
        tone: 'success',
      });
      return;
    }

    for (const [num, count] of [...counter]) {
      if (count === 0) {
        r.step({
          at: 'if (count == 0) continue;',
          explain: `No copies of ${num} left to place here — skip it.`,
          vars: { num, count },
          visuals: view(),
          tone: 'warn',
        });
        continue;
      }

      combination.push(num);
      counter.set(num, count - 1);
      const child = mkNode(`[${combination.join(',')}]`, `+${num}`);
      child.state = 'active';
      node.children!.push(child);
      r.step({
        at: ['combination.add(num);', 'counter.put(num, count - 1);'],
        explain: `Place ${num} at position ${combination.length - 1}, using up one of its remaining copies.`,
        vars: { num, count, combination: list(combination) },
        visuals: view(),
      });
      dfs(child);
      if (child.state === 'active') child.state = 'done';
      combination.pop();
      counter.set(num, count);
      r.step({
        at: ['combination.remove(combination.size() - 1);', 'counter.put(num, count);'],
        explain: `Backtrack: return ${num}'s copy to the counter so a sibling branch can use it.`,
        vars: { num, count, combination: list(combination) },
        visuals: view(),
        tone: 'warn',
      });
    }
  };

  dfs(root);
  r.step({
    at: 'return res;',
    explain: `${res.length} distinct permutation(s) — repeated numbers never produced a duplicate, because each was chosen by count rather than by position.`,
    visuals: view(),
    tone: 'success',
    result: `return ${res.map((s) => `[${s.join(',')}]`).join(', ')}`,
  });
}

/* ── Generate Parentheses ─────────────────────────────────────────────────── */

function generateParenthesis(r: Recorder, n: number) {
  const res: string[] = [];
  const calls: string[] = [];
  const sb: string[] = [];

  const view = (open: number, close: number, state: CellState = 'active'): Visual[] => [
    arr(sb, { title: 'sb  (shared StringBuilder)', states: sb.map(() => state), indexed: false }),
    arr([open, close, n], { title: 'counters', labels: ['open', 'close', 'n'], indexed: false }),
    frames('call stack', calls.slice().reverse()),
    resultsViz('res', res.map((x) => `"${x}"`)),
  ];

  r.step({
    at: 'backtrack(n, 0, 0, new StringBuilder(2 * n), res);',
    explain: `Build the string one character at a time in a single shared buffer, obeying two rules: never more than ${n} "(", and never more ")" than "(". Appending then deleting the last character is how backtracking undoes a choice on a mutable buffer instead of allocating a new string each call.`,
    vars: { n },
    visuals: view(0, 0, 'idle'),
  });

  const backtrack = (open: number, close: number) => {
    calls.push(`backtrack(open=${open}, close=${close})`);
    if (open === close && close === n) {
      res.push(sb.join(''));
      r.step({
        at: ['if (open == close && close == n) {', 'res.add(sb.toString());'],
        explain: `"${sb.join('')}" uses all ${n} pairs and is balanced.`,
        vars: { sb: `"${sb.join('')}"`, open, close },
        visuals: view(open, close, 'success'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    if (open < n) {
      sb.push('(');
      r.step({
        at: ['if (open < n) {', "sb.append('(');"],
        explain: `Only ${open} of ${n} opening brackets used, so "(" is allowed.`,
        vars: { sb: `"${sb.join('')}"`, open: open + 1, close },
        visuals: view(open + 1, close),
      });
      backtrack(open + 1, close);
      sb.pop();
      r.step({
        at: 'sb.deleteCharAt(sb.length() - 1);@1',
        explain: `Undo the '(' — the buffer goes back to "${sb.join('')}" so this level can try something else.`,
        vars: { sb: `"${sb.join('')}"`, open, close },
        visuals: view(open, close, 'compare'),
        tone: 'warn',
      });
    }

    if (close < open) {
      sb.push(')');
      r.step({
        at: ['if (close < open) {', "sb.append(')');"],
        explain: `${open - close} unmatched "(" still open, so ")" keeps the string valid.`,
        vars: { sb: `"${sb.join('')}"`, open, close: close + 1 },
        visuals: view(open, close + 1),
      });
      backtrack(open, close + 1);
      sb.pop();
      r.step({
        at: 'sb.deleteCharAt(sb.length() - 1);@2',
        explain: `Undo the ')' — the buffer goes back to "${sb.join('')}".`,
        vars: { sb: `"${sb.join('')}"`, open, close },
        visuals: view(open, close, 'compare'),
        tone: 'warn',
      });
    }
    calls.pop();
  };

  backtrack(0, 0);
  r.step({
    at: 'return res;',
    explain: `${res.length} well-formed strings for n = ${n}.`,
    visuals: [resultsViz('res', res.map((x) => `"${x}"`))],
    tone: 'success',
    result: `return [${res.map((x) => `"${x}"`).join(', ')}]`,
  });
}

/* ── Letter Combinations of a Phone Number ────────────────────────────────── */

const KEYPAD: Record<string, string[]> = {
  '2': ['a', 'b', 'c'],
  '3': ['d', 'e', 'f'],
  '4': ['g', 'h', 'i'],
  '5': ['j', 'k', 'l'],
  '6': ['m', 'n', 'o'],
  '7': ['p', 'q', 'r', 's'],
  '8': ['t', 'u', 'v'],
  '9': ['w', 'x', 'y', 'z'],
};

function letterCombinations(r: Recorder, digits: string) {
  const res: string[] = [];
  const combination: string[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `lc${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('""');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (one child per letter on the current digit)' }),
    resultsViz('res', res.map((x) => `"${x}"`)),
  ];

  if (digits.length === 0) {
    r.step({
      at: 'if (digits.isEmpty()) return res;',
      explain: 'No digits, no combinations.',
      visuals: [],
      tone: 'warn',
      result: 'return []',
    });
    return;
  }

  r.step({
    at: 'backtracking(0, digits, new StringBuilder());',
    explain: 'One recursion level per digit; the loop inside tries every letter on that key, so each node fans out into up to 4 children.',
    visuals: view(),
  });

  const backtracking = (i: number, node: DecisionTreeNodeViz) => {
    if (i === digits.length) {
      res.push(combination.join(''));
      node.label = `"${combination.join('')}" ✓`;
      node.state = 'success';
      r.step({
        at: ['if (i == digits.length()) {', 'res.add(combination.toString());'],
        explain: `Every digit has a letter: "${combination.join('')}".`,
        vars: { combination: `"${combination.join('')}"` },
        visuals: view(),
        tone: 'success',
      });
      return;
    }

    for (const ch of KEYPAD[digits[i]]) {
      combination.push(ch);
      const child = mkNode(`"${combination.join('')}"`, `${digits[i]}→${ch}`);
      child.state = 'active';
      node.children!.push(child);
      r.step({
        at: ['combination.append(character);', 'backtracking(i + 1, digits, combination);'],
        explain: `Digit '${digits[i]}' → try '${ch}'.`,
        vars: { i, character: ch, combination: `"${combination.join('')}"` },
        visuals: view(),
      });
      backtracking(i + 1, child);
      if (child.state === 'active') child.state = 'done';
      combination.pop();
      r.step({
        at: 'combination.deleteCharAt(combination.length() - 1);',
        explain: `Remove '${ch}' again — a StringBuilder is mutable, so the undo has to be explicit.`,
        vars: { i, combination: `"${combination.join('')}"` },
        visuals: view(),
        tone: 'warn',
      });
    }
  };

  backtracking(0, root);
  r.step({
    at: 'return res;@2',
    explain: `${res.length} combinations.`,
    visuals: view(),
    tone: 'success',
    result: `return [${res.map((x) => `"${x}"`).join(', ')}]`,
  });
}

/* ── Palindrome Partitioning ──────────────────────────────────────────────── */

function palindromePartitioning(r: Recorder, s: string) {
  const res: string[][] = [];
  const partition: string[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `pp${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const isPal = (str: string) => {
    let a = 0;
    let b = str.length - 1;
    while (a < b) {
      if (str[a] !== str[b]) return false;
      a++;
      b--;
    }
    return true;
  };

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (cut here if s[l..r] is a palindrome, or extend the window)' }),
    resultsViz('res', res.map((p) => `[${p.map((x) => `"${x}"`).join(',')}]`)),
  ];

  r.step({
    at: 'backtrack(s, 0, 0, new ArrayList<>());',
    explain:
      'l marks where the next piece must start and r sweeps forward. At every (l, r) the window s[l..r] may be cut off as a piece if it is a palindrome, and — independently — the window can always grow by extending r.',
    vars: { s },
    visuals: view(),
  });

  const backtrack = (l: number, rr: number, node: DecisionTreeNodeViz) => {
    if (rr === s.length) {
      if (l === rr) {
        res.push(partition.slice());
        node.label = `[${partition.join(',')}] ✓`;
        node.state = 'success';
        r.step({
          at: ['if (r == s.length()) {', 'if (l == r) res.add(new ArrayList<>(partition));'],
          explain: `Every character of "${s}" is covered by a piece — [${partition.map((p) => `"${p}"`).join(', ')}] is a valid partition.`,
          vars: { l, r: rr },
          visuals: view(),
          tone: 'success',
        });
      } else {
        node.label = `[${partition.join(',')}] ✗`;
        node.state = 'error';
        r.step({
          at: ['if (r == s.length()) {', 'return;'],
          explain: `The end of "${s}" is reached, but "${s.slice(l)}" was never cut off as its own palindrome — dead end.`,
          vars: { l, r: rr },
          visuals: view(),
          tone: 'warn',
        });
      }
      return;
    }

    const piece = s.slice(l, rr + 1);
    const pal = isPal(piece);
    r.step({
      at: 'if (isPalindrome(s, l, r)) {',
      explain: pal
        ? `"${piece}" (s[${l}..${rr}]) is a palindrome — it can be cut off here.`
        : `"${piece}" (s[${l}..${rr}]) is not a palindrome — it cannot be cut here yet.`,
      vars: { l, r: rr, piece: `"${piece}"` },
      visuals: view(),
      tone: pal ? 'success' : 'neutral',
    });

    if (pal) {
      partition.push(piece);
      const cutNode = mkNode(`[${partition.join(',')}]`, `cut "${piece}"`);
      cutNode.state = 'active';
      node.children!.push(cutNode);
      r.step({
        at: ['partition.add(s.substring(l, r + 1));', 'backtrack(s, r + 1, r + 1, partition);'],
        explain: `Take "${piece}" as the next piece and start a fresh window right after it.`,
        vars: { l: rr + 1, r: rr + 1, partition: `[${partition.map((p) => `"${p}"`).join(', ')}]` },
        visuals: view(),
      });
      backtrack(rr + 1, rr + 1, cutNode);
      if (cutNode.state === 'active') cutNode.state = 'done';
      partition.pop();

      r.step({
        at: 'partition.remove(partition.size() - 1);',
        explain: `Backtrack: remove "${piece}" so other partitions can still be explored.`,
        vars: { l, r: rr },
        visuals: view(),
        tone: 'warn',
      });
    }

    const extendNode = mkNode(`[${partition.join(',')}]`, `extend → "${s.slice(l, rr + 2)}"`);
    extendNode.state = 'active';
    node.children!.push(extendNode);
    r.step({
      at: 'backtrack(s, l, r + 1, partition);',
      explain: `Also try growing the window: keep "${piece}" uncut and extend it with the next character.`,
      vars: { l, r: rr + 1 },
      visuals: view(),
    });
    backtrack(l, rr + 1, extendNode);
    if (extendNode.state === 'active') extendNode.state = 'done';
  };

  backtrack(0, 0, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} way(s) to partition "${s}" into palindromes.`,
    visuals: view(),
    tone: 'success',
    result: `return [${res.map((p) => `[${p.map((x) => `"${x}"`).join(',')}]`).join(', ')}]`,
  });
}

/* ── Word Search ──────────────────────────────────────────────────────────── */

function wordSearch(r: Recorder, input: string[][], word: string) {
  const board = input.map((row) => row.slice());
  const ROWS = board.length;
  const COLS = board[0].length;
  const calls: string[] = [];

  const view = (rr: number, cc: number, i: number, state: CellState): Visual[] => [
    grid(board, {
      title: "board  ('#' marks cells used by the current path)",
      cursor: rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS ? [rr, cc] : undefined,
      states: board.map((row, r2) =>
        row.map((v, c2) => (r2 === rr && c2 === cc ? state : v === '#' ? ('window' as CellState) : undefined)),
      ),
    }),
    arr(chars(word), {
      title: 'word',
      states: chars(word).map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('success' as CellState) : undefined)),
      pointers: i < word.length ? [{ name: 'i', index: i }] : [],
    }),
    frames('call stack', calls.slice().reverse()),
  ];

  const backtrack = (rr: number, cc: number, i: number): boolean => {
    if (i === word.length) {
      r.step({
        at: 'if (i == word.length()) return true;',
        explain: `Every character of "${word}" has been matched.`,
        visuals: view(rr, cc, i, 'success'),
        tone: 'success',
      });
      return true;
    }
    if (rr < 0 || cc < 0 || rr === ROWS || cc === COLS || board[rr][cc] === '#' || board[rr][cc] !== word[i]) {
      const why =
        rr < 0 || cc < 0 || rr === ROWS || cc === COLS
          ? 'off the board'
          : board[rr][cc] === '#'
            ? 'already used on this path'
            : `'${board[rr][cc]}' ≠ '${word[i]}'`;
      r.step({
        // The second `return false;` is backtrack's; the first one ends exist().
        at: ["board[r][c] == '#' || board[r][c] != word.charAt(i)) {", 'return false;@2'],
        explain: `(${rr}, ${cc}) fails: ${why}.`,
        vars: { r: rr, c: cc, i },
        visuals: view(rr, cc, i, 'error'),
      });
      return false;
    }

    const temp = board[rr][cc];
    board[rr][cc] = '#';
    calls.push(`backtrack(${rr}, ${cc}, i=${i})`);
    r.step({
      at: ["board[r][c] = '#';", 'boolean res ='],
      explain: `'${temp}' matches word[${i}]. Mark the cell as used and try all four directions for word[${i + 1}].`,
      vars: { r: rr, c: cc, i, char: temp },
      visuals: view(rr, cc, i, 'active'),
      tone: 'success',
    });

    const found =
      backtrack(rr + 1, cc, i + 1) ||
      backtrack(rr - 1, cc, i + 1) ||
      backtrack(rr, cc + 1, i + 1) ||
      backtrack(rr, cc - 1, i + 1);

    board[rr][cc] = temp;
    calls.pop();
    if (!found) {
      r.step({
        at: 'board[r][c] = word.charAt(i);',
        explain: `No direction from (${rr}, ${cc}) completed the word — restore '${temp}' so other paths can use this cell.`,
        vars: { r: rr, c: cc, i },
        visuals: view(rr, cc, i, 'compare'),
        tone: 'warn',
      });
    }
    return found;
  };

  r.step({
    at: 'if (board[r][c] == word.charAt(0) && backtrack(r, c, word, 0)) {',
    explain: `Try to start the search only at cells holding '${word[0]}', the first character of "${word}".`,
    visuals: view(-1, -1, 0, 'idle'),
  });

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (board[rr][cc] !== word[0]) continue;
      r.step({
        at: 'if (board[r][c] == word.charAt(0) && backtrack(r, c, word, 0)) {',
        explain: `(${rr}, ${cc}) holds '${word[0]}' — start a path here.`,
        vars: { r: rr, c: cc },
        visuals: view(rr, cc, 0, 'active'),
      });
      if (backtrack(rr, cc, 0)) {
        r.step({
          at: 'return true;@1',
          explain: `"${word}" exists on the board.`,
          visuals: view(-1, -1, word.length, 'success'),
          tone: 'success',
          result: 'return true',
        });
        return;
      }
    }
  }

  r.step({
    at: 'return false;@1',
    explain: `No path spells "${word}".`,
    visuals: view(-1, -1, 0, 'error'),
    tone: 'error',
    result: 'return false',
  });
}

/* ── Matchsticks to Square ────────────────────────────────────────────────── */

function matchsticksToSquare(r: Recorder, input: number[]) {
  const sum = input.reduce((a, b) => a + b, 0);
  let sticks = input.slice();
  const sides = [0, 0, 0, 0];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `ms${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[0,0,0,0]');

  const sticksViz = (i: number, state: CellState = 'active') =>
    arr(sticks, {
      title: 'matchsticks',
      states: sticks.map((_, k) => (k === i ? state : k < i ? ('done' as CellState) : undefined)),
      pointers: i >= 0 && i < sticks.length ? [{ name: 'i', index: i }] : [],
    });
  const view = (i: number, state?: CellState): Visual[] => [
    sticksViz(i, state),
    decisionTree(root, { title: 'decision tree  (one child per side the next stick could join)' }),
  ];

  r.step({
    at: 'int sum = Arrays.stream(matchsticks).sum();',
    explain: `Total matchstick length is ${sum}. Every stick must be used, so each of the four sides has to be exactly a quarter of it.`,
    vars: { sum },
    visuals: view(-1),
  });

  sticks = sticks.sort((a, b) => a - b).reverse();
  r.step({
    at: ['Arrays.sort(matchsticks);', 'reverse(matchsticks);'],
    explain:
      'Sort longest first. A long stick fits on fewer sides, so placing it early makes a dead end overflow near the root, where pruning it cuts away the whole subtree below.',
    vars: { matchsticks: list(sticks) },
    visuals: view(-1),
  });

  const length = Math.floor(sum / 4);
  if (sum % 4 !== 0) {
    root.label = `${sum} ✗`;
    root.state = 'error';
    r.step({
      at: ['int length = sum / 4;', 'if (sum % 4 != 0) return false;'],
      explain: `${sum} is not divisible by 4, so four equal sides are impossible. Return before trying a single placement.`,
      vars: { sum, length },
      visuals: view(-1),
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  r.step({
    at: ['int length = sum / 4;', 'if (sum % 4 != 0) return false;', 'int[] sides = new int[4];', 'return backtrack(matchsticks, sides, length, 0);'],
    explain: `Each side must reach exactly ${length}. Place the sticks one at a time, trying each on every side that still has room for it.`,
    vars: { sum, length },
    visuals: view(-1),
  });

  const backtrack = (i: number, node: DecisionTreeNodeViz): boolean => {
    if (i === sticks.length) {
      const ok = sides[0] === sides[1] && sides[1] === sides[2] && sides[2] === sides[3];
      node.label = `[${sides.join(',')}] ${ok ? '✓' : '✗'}`;
      node.state = ok ? 'success' : 'error';
      r.step({
        at: ['if (i == matchsticks.length) {', 'return sides[0] == sides[1] &&', 'sides[1] == sides[2] &&', 'sides[2] == sides[3];'],
        explain: ok
          ? `Every stick is placed and the sides are [${sides.join(', ')}]. No side was allowed past ${length} and the total is 4 × ${length}, so all four must equal ${length}: a square.`
          : `Every stick is placed, but the sides are [${sides.join(', ')}], which are not all equal.`,
        vars: { i, sides: list(sides) },
        visuals: view(i),
        tone: ok ? 'success' : 'error',
      });
      return ok;
    }

    const stick = sticks[i];
    for (let j = 0; j < 4; j++) {
      if (sides[j] + stick > length) {
        const pruned = mkNode(`s${j}: ${sides[j]}+${stick} > ${length}`, `+${stick} → s${j}`);
        pruned.state = 'muted';
        node.children!.push(pruned);
        r.step({
          at: 'if (sides[j] + matchsticks[i] <= length) {',
          explain: `Stick ${stick} would push side ${j} to ${sides[j] + stick}, past ${length}. That can never become a square, so skip it without recursing.`,
          vars: { i, j, stick, 'sides[j]': sides[j], length },
          visuals: view(i, 'error'),
          tone: 'warn',
        });
        continue;
      }

      sides[j] += stick;
      const child = mkNode(`[${sides.join(',')}]`, `+${stick} → s${j}`);
      child.state = 'active';
      node.children!.push(child);
      r.step({
        at: ['sides[j] += matchsticks[i];', 'if (backtrack(matchsticks, sides, length, i + 1)) return true;'],
        explain: `Stick ${stick} fits on side ${j} (now ${sides[j]} of ${length}). Recurse to place the next stick.`,
        vars: { i, j, stick, 'sides[j]': sides[j], length },
        visuals: view(i),
      });
      if (backtrack(i + 1, child)) return true;
      if (child.state === 'active') child.state = 'done';
      sides[j] -= stick;
      r.step({
        at: 'sides[j] -= matchsticks[i];',
        explain: `No square below side ${j}. Take stick ${stick} back off (side ${j} returns to ${sides[j]}) and try the next side.`,
        vars: { i, j, stick, 'sides[j]': sides[j], length },
        visuals: view(i, 'compare'),
        tone: 'warn',
      });
    }

    node.state = 'error';
    r.step({
      at: 'return false;@2',
      explain: `Stick ${stick} has no side left to go on, so this branch is a dead end. Report false to the caller.`,
      vars: { i, stick, sides: list(sides) },
      visuals: view(i, 'error'),
      tone: 'error',
    });
    return false;
  };

  const found = backtrack(0, root);
  r.step({
    at: 'return backtrack(matchsticks, sides, length, 0);',
    explain: found
      ? `A square exists: each side is ${length} long.`
      : 'Every placement either overflowed a side or got stuck, so no square can be made.',
    visuals: view(found ? sticks.length : -1),
    tone: found ? 'success' : 'error',
    result: `return ${found}`,
  });
}

/* ── Partition to K Equal Sum Subsets ─────────────────────────────────────── */

function partitionKSubsets(r: Recorder, input: number[], k: number) {
  const sum = input.reduce((a, b) => a + b, 0);
  let nums = input.slice();
  const subsets = new Array<number>(k).fill(0);
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `pk${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode(`[${subsets.join(',')}]`);

  const view = (i: number, state: CellState = 'active'): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, x) => (x === i ? state : x < i ? ('done' as CellState) : undefined)),
      pointers: i >= 0 && i < nums.length ? [{ name: 'i', index: i }] : [],
    }),
    decisionTree(root, { title: 'decision tree  (one child per subset the next number could join)' }),
  ];

  r.step({
    at: 'int sum = Arrays.stream(nums).sum();',
    explain: `The numbers add up to ${sum}. Every number must land in one of the ${k} subsets, so each subset has to sum to exactly ${sum} / ${k}.`,
    vars: { sum, k },
    visuals: view(-1),
  });

  if (sum % k !== 0) {
    root.label = `${sum} ✗`;
    root.state = 'error';
    r.step({
      at: 'if (sum % k != 0) return false;',
      explain: `${sum} is not divisible by ${k}, so ${k} equal subsets are impossible. Return before trying a single placement.`,
      vars: { sum, k },
      visuals: view(-1),
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  nums = nums.sort((a, b) => a - b).reverse();
  const subsetSum = sum / k;
  r.step({
    at: ['if (sum % k != 0) return false;', 'Arrays.sort(nums);', 'reverse(nums);', 'int subsetSum = sum / k;'],
    explain: `Each subset must reach ${subsetSum}. Sort longest first: a big number fits in fewer subsets, so a dead end overflows near the root, where pruning it removes the most work.`,
    vars: { sum, k, subsetSum, nums: list(nums) },
    visuals: view(-1),
  });

  r.step({
    at: ['int[] subsets = new int[k];', 'return backtrack(nums, subsets, k, subsetSum, 0);'],
    explain: `Start with ${k} empty subsets and place the numbers one at a time, trying each in every subset that still has room for it.`,
    vars: { subsets: list(subsets), subsetSum },
    visuals: view(-1),
  });

  const backtrack = (i: number, node: DecisionTreeNodeViz): boolean => {
    if (i === nums.length) {
      const ok = subsets.every((s) => s === subsetSum);
      node.label = `[${subsets.join(',')}] ${ok ? '✓' : '✗'}`;
      node.state = ok ? 'success' : 'error';
      r.step({
        at: ok
          ? ['if (i == nums.length) {', 'if (subsets[j] != subsetSum) return false;', 'return true;@1']
          : ['if (i == nums.length) {', 'if (subsets[j] != subsetSum) return false;'],
        explain: ok
          ? `Every number is placed and each subset sums to ${subsetSum}. None was allowed past ${subsetSum} and the total is ${k} × ${subsetSum}, so they had to come out equal.`
          : `Every number is placed, but the subsets are [${subsets.join(', ')}], which are not all ${subsetSum}.`,
        vars: { i, subsets: list(subsets) },
        visuals: view(i),
        tone: ok ? 'success' : 'error',
      });
      return ok;
    }

    const num = nums[i];
    for (let j = 0; j < k; j++) {
      if (subsets[j] + num > subsetSum) {
        const pruned = mkNode(`s${j}: ${subsets[j]}+${num} > ${subsetSum}`, `+${num} → s${j}`);
        pruned.state = 'muted';
        node.children!.push(pruned);
        r.step({
          at: 'if (subsets[j] + nums[i] <= subsetSum) {',
          explain: `${num} would push subset ${j} to ${subsets[j] + num}, past ${subsetSum}. That subset can never come back down, so skip it without recursing.`,
          vars: { i, j, 'nums[i]': num, 'subsets[j]': subsets[j], subsetSum },
          visuals: view(i, 'error'),
          tone: 'warn',
        });
        continue;
      }

      subsets[j] += num;
      const child = mkNode(`[${subsets.join(',')}]`, `+${num} → s${j}`);
      child.state = 'active';
      node.children!.push(child);
      r.step({
        at: ['subsets[j] += nums[i];', 'if (backtrack(nums, subsets, k, subsetSum, i + 1)) return true;'],
        explain: `${num} fits in subset ${j} (now ${subsets[j]} of ${subsetSum}). Recurse to place the next number.`,
        vars: { i, j, 'nums[i]': num, 'subsets[j]': subsets[j], subsetSum },
        visuals: view(i),
      });
      if (backtrack(i + 1, child)) return true;
      if (child.state === 'active') child.state = 'done';
      subsets[j] -= num;
      r.step({
        at: 'subsets[j] -= nums[i];',
        explain: `No valid partition below subset ${j}. Take ${num} back out (subset ${j} returns to ${subsets[j]}) and try the next subset.`,
        vars: { i, j, 'nums[i]': num, 'subsets[j]': subsets[j], subsetSum },
        visuals: view(i, 'compare'),
        tone: 'warn',
      });
    }

    node.state = 'error';
    r.step({
      at: 'return false;@3',
      explain: `${num} has no subset left to go in, so this branch is a dead end. Report false to the caller.`,
      vars: { i, 'nums[i]': num, subsets: list(subsets) },
      visuals: view(i, 'error'),
      tone: 'error',
    });
    return false;
  };

  const found = backtrack(0, root);
  r.step({
    at: 'return backtrack(nums, subsets, k, subsetSum, 0);',
    explain: found
      ? `The numbers split into ${k} subsets that each sum to ${subsetSum}.`
      : `Every placement either overflowed a subset or got stuck, so no split into ${k} equal subsets exists.`,
    visuals: view(found ? nums.length : -1),
    tone: found ? 'success' : 'error',
    result: `return ${found}`,
  });
}

/* ── Combinations ─────────────────────────────────────────────────────────── */

function combinations(r: Recorder, n: number, k: number) {
  const res: number[][] = [];
  const combination: number[] = [];
  let uid = 0;
  const mkNode = (label: string, edgeLabel?: string): DecisionTreeNodeViz => ({ id: `cb${uid++}`, label, edgeLabel, children: [] });
  const root = mkNode('[]');

  const view = (): Visual[] => [
    decisionTree(root, { title: 'decision tree  (take i then leave it out, per node)' }),
    resultsViz('res', res.map((c) => `[${c.join(', ')}]`)),
  ];

  r.step({
    at: 'backtrack(1, n, k, new ArrayList<>());',
    explain: `Each number from 1 to ${n} is either taken or left out, the same binary tree as Subsets. A leaf is kept only if it took exactly ${k} numbers.`,
    vars: { n, k },
    visuals: view(),
  });

  const backtrack = (i: number, node: DecisionTreeNodeViz) => {
    if (i === n + 1) {
      const ok = combination.length === k;
      if (ok) res.push(combination.slice());
      node.label = `[${combination.join(',')}] ${ok ? '✓' : '✗'}`;
      node.state = ok ? 'success' : 'error';
      r.step({
        at: ok ? ['if (i == n + 1) {', 'if (combination.size() == k) {', 'res.add(new ArrayList<>(combination));'] : ['if (i == n + 1) {', 'if (combination.size() == k) {', 'return;'],
        explain: ok
          ? `All ${n} numbers are decided and exactly ${k} were taken, so record a copy of [${combination.join(', ')}]. The copy matters because the list keeps changing.`
          : `All ${n} numbers are decided, but ${combination.length} were taken instead of ${k}. Nothing stopped this branch early, so it is only thrown away here at the leaf.`,
        vars: { i, combination: list(combination), size: combination.length, k },
        visuals: view(),
        tone: ok ? 'success' : 'error',
      });
      return;
    }

    combination.push(i);
    const takeNode = mkNode(`[${combination.join(',')}]`, `+${i}`);
    takeNode.state = 'active';
    node.children!.push(takeNode);
    r.step({
      at: ['combination.add(i);', 'backtrack(i + 1, n, k, combination);@1'],
      explain: `Branch 1: take ${i}.`,
      vars: { i, combination: list(combination) },
      visuals: view(),
    });
    backtrack(i + 1, takeNode);
    if (takeNode.state === 'active') takeNode.state = 'done';
    combination.pop();

    const skipNode = mkNode(`[${combination.join(',')}]`, `skip ${i}`);
    skipNode.state = 'active';
    node.children!.push(skipNode);
    r.step({
      at: ['combination.remove(combination.size() - 1);', 'backtrack(i + 1, n, k, combination);@2'],
      explain: `Every combination containing ${i} along this path is done. Remove ${i} and branch again without it.`,
      vars: { i, combination: list(combination) },
      visuals: view(),
      tone: 'warn',
    });
    backtrack(i + 1, skipNode);
    if (skipNode.state === 'active') skipNode.state = 'done';
  };

  backtrack(1, root);
  r.step({
    at: 'return res;',
    explain: `${res.length} ${res.length === 1 ? 'combination' : 'combinations'} of ${k} from ${n}, found by visiting all 2^${n} = ${2 ** n} leaves.`,
    visuals: view(),
    tone: 'success',
    result: `return ${res.length} ${res.length === 1 ? 'combination' : 'combinations'}`,
  });
}

/* ── N-Queens ─────────────────────────────────────────────────────────────── */

function nQueens(r: Recorder, n: number) {
  const board = Array.from({ length: n }, () => new Array<string>(n).fill('.'));
  const col = new Set<number>();
  const negDiag = new Set<number>();
  const posDiag = new Set<number>();
  const res: string[][] = [];
  const labels = Array.from({ length: n }, (_, x) => String(x));

  const attacked = (rr: number, cc: number) => col.has(cc) || negDiag.has(rr - cc) || posDiag.has(rr + cc);
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

  const view = (cr: number, cc: number, state: CellState, solved = false): Visual[] => [
    grid(board, {
      title: 'board  (shaded cells are attacked by a queen already placed)',
      rowLabels: labels,
      colLabels: labels,
      cursor: cr >= 0 && cr < n ? [cr, cc] : undefined,
      states: board.map((row, rr) =>
        row.map((v, c2) => {
          if (rr === cr && c2 === cc) return state;
          if (v === 'Q') return solved ? 'success' : 'done';
          return attacked(rr, c2) ? 'muted' : undefined;
        }),
      ),
    }),
    setOf('col', sorted(col)),
    setOf('negDiag  (r - c)', sorted(negDiag)),
    setOf('posDiag  (r + c)', sorted(posDiag)),
    resultsViz('res', res.map((b) => b.join(' / '))),
  ];

  r.step({
    at: ['char[][] board = new char[n][n];', 'backtrack(0, board);'],
    explain: `Two queens in the same row attack each other, so each of the ${n} rows gets exactly one. Go row by row, top to bottom, trying each column.`,
    vars: { n },
    visuals: view(-1, -1, 'idle'),
  });

  const backtrack = (rr: number) => {
    if (rr === n) {
      res.push(board.map((row) => row.join('')));
      r.step({
        at: ['if (r == board.length) {', 'res.add(new ArrayList<>());', 'res.get(res.size() - 1).add(new String(row));'],
        explain: `A queen sits in all ${n} rows. Each one was only placed where nothing attacked it, so the board is a valid solution: copy it into res.`,
        vars: { r: rr, solutions: res.length },
        visuals: view(-1, -1, 'idle', true),
        tone: 'success',
      });
      return;
    }

    for (let cc = 0; cc < n; cc++) {
      if (attacked(rr, cc)) {
        const why = col.has(cc)
          ? `column ${cc} already has a queen`
          : negDiag.has(rr - cc)
            ? `the diagonal r - c = ${rr - cc} already has a queen`
            : `the anti-diagonal r + c = ${rr + cc} already has a queen`;
        r.step({
          at: ['if (col.contains(c) ||', 'negDiag.contains(r - c) ||', 'posDiag.contains(r + c)) {', 'continue;'],
          explain: `(${rr}, ${cc}) is attacked: ${why}. Every cell on a diagonal shares r - c, and every cell on an anti-diagonal shares r + c, so one set lookup decides it.`,
          vars: { r: rr, c: cc, 'r - c': rr - cc, 'r + c': rr + cc },
          visuals: view(rr, cc, 'error'),
          tone: 'warn',
        });
        continue;
      }

      col.add(cc);
      negDiag.add(rr - cc);
      posDiag.add(rr + cc);
      board[rr][cc] = 'Q';
      r.step({
        at: ['col.add(c);', 'negDiag.add(r - c);', 'posDiag.add(r + c);', "board[r][c] = 'Q';", 'backtrack(r + 1, board);'],
        explain: `(${rr}, ${cc}) is safe. Place a queen and claim its column ${cc}, diagonal ${rr - cc} and anti-diagonal ${rr + cc}, then move on to row ${rr + 1}.`,
        vars: { r: rr, c: cc, 'r - c': rr - cc, 'r + c': rr + cc },
        visuals: view(rr, cc, 'active'),
      });
      backtrack(rr + 1);

      col.delete(cc);
      negDiag.delete(rr - cc);
      posDiag.delete(rr + cc);
      board[rr][cc] = '.';
      r.step({
        at: ['col.remove(c);', 'negDiag.remove(r - c);', 'posDiag.remove(r + c);', "board[r][c] = '.';"],
        explain: `Every board with a queen at (${rr}, ${cc}) has been explored. Lift it and release its column and diagonals so the next column in row ${rr} can be tried.`,
        vars: { r: rr, c: cc },
        visuals: view(rr, cc, 'compare'),
        tone: 'warn',
      });
    }
  };

  backtrack(0);
  r.step({
    at: 'return res;',
    explain:
      res.length > 0
        ? `${res.length} distinct ways to place ${n} queens so that none attack each other.`
        : `Every placement eventually left some row with no safe column, so no ${n}×${n} board works.`,
    visuals: view(-1, -1, 'idle'),
    tone: res.length > 0 ? 'success' : 'error',
    result: `return ${res.length} solution${res.length === 1 ? '' : 's'}`,
  });
}

/* ── Sum of All Subsets' XOR Total ────────────────────────────────────────── */

function subsetXORSum(r: Recorder, nums: number[]) {
  let res = 0;
  const calls: string[] = [];
  const leaves: string[] = [];

  const view = (i: number, xor: number, state: CellState = 'active'): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, k) => (k === i ? state : k < i ? ('visited' as CellState) : undefined)),
      pointers: i < nums.length ? [{ name: 'i', index: i }] : [],
      note: `running xor: ${xor}`,
    }),
    frames('call stack', calls.slice().reverse()),
    chips('leaf totals (xor of each subset)', leaves, { emptyHint: '[]' }),
  ];

  r.step({
    at: 'int res = 0;',
    explain:
      'Every subset is a path through the same binary decision tree as Subsets: include nums[i] in the running xor, or leave it out. A leaf is reached once all n elements are decided, and its xor is added to the total.',
    visuals: view(0, 0, 'idle'),
  });

  const dfs = (i: number, xor: number) => {
    calls.push(`dfs(i=${i}, xor=${xor})`);
    if (i === nums.length) {
      res += xor;
      leaves.push(`${xor}`);
      r.step({
        at: ['res += xor;', 'return;'],
        explain: `Every element has been decided — this subset's xor is ${xor}, added to the running total (now ${res}).`,
        vars: { i, xor, res },
        visuals: view(i, xor, 'success'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    r.step({
      at: 'dfs(nums, i + 1, xor ^ nums[i]);',
      explain: `Include nums[${i}] = ${nums[i]}: xor becomes ${xor} ^ ${nums[i]} = ${xor ^ nums[i]}.`,
      vars: { i, 'nums[i]': nums[i], xor: xor ^ nums[i] },
      visuals: view(i, xor, 'success'),
    });
    dfs(i + 1, xor ^ nums[i]);

    r.step({
      at: 'dfs(nums, i + 1, xor);',
      explain: `Leave nums[${i}] = ${nums[i]} out: xor stays ${xor}.`,
      vars: { i, 'nums[i]': nums[i], xor },
      visuals: view(i, xor, 'muted'),
    });
    dfs(i + 1, xor);

    calls.pop();
  };

  dfs(0, 0);
  r.step({
    at: 'return res;',
    explain: `Summing the xor of every one of the 2^${nums.length} subsets gives ${res}.`,
    vars: { res },
    visuals: [chips('leaf totals (xor of each subset)', leaves, { emptyHint: '[]' })],
    tone: 'success',
    result: `return ${res}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const backtrackingTracers: Record<string, Tracer> = {
  'medium/backtracking/Subsets': {
    examples: [
      { label: 'nums = [1,2,3]', input: 'nums = [1, 2, 3]', run: (r) => subsets(r, [1, 2, 3]) },
      { label: 'nums = [7,8]', input: 'nums = [7, 8]', run: (r) => subsets(r, [7, 8]) },
    ],
  },
  'medium/backtracking/SubsetsII': {
    examples: [
      { label: 'nums = [1,2,2]', input: 'nums = [1, 2, 2]', run: (r) => subsetsII(r, [1, 2, 2]) },
      { label: 'nums = [2,1,2]', input: 'nums = [2, 1, 2]', run: (r) => subsetsII(r, [2, 1, 2]) },
    ],
  },
  'medium/backtracking/CombinationSum': {
    examples: [
      { label: 'nums = [2,5,6,9], target = 9', input: 'nums = [2, 5, 6, 9], target = 9', run: (r) => combinationSum(r, [2, 5, 6, 9], 9) },
      { label: 'nums = [3,4,5], target = 8', input: 'nums = [3, 4, 5], target = 8', run: (r) => combinationSum(r, [3, 4, 5], 8) },
    ],
  },
  'medium/backtracking/CombinationSumII': {
    examples: [
      { label: 'candidates = [9,2,2,4,1], target = 8', input: 'candidates = [9, 2, 2, 4, 1], target = 8', run: (r) => combinationSumII(r, [9, 2, 2, 4, 1], 8) },
      { label: 'candidates = [1,1,2], target = 3', input: 'candidates = [1, 1, 2], target = 3', run: (r) => combinationSumII(r, [1, 1, 2], 3) },
    ],
  },
  'medium/backtracking/Permutations': {
    examples: [
      { label: 'nums = [1,2,3]', input: 'nums = [1, 2, 3]', run: (r) => permutations(r, [1, 2, 3]) },
      { label: 'nums = [4,5]', input: 'nums = [4, 5]', run: (r) => permutations(r, [4, 5]) },
    ],
  },
  'medium/backtracking/PermutationsII': {
    examples: [
      { label: 'nums = [1,1,2]', input: 'nums = [1, 1, 2]', run: (r) => permutationsUnique(r, [1, 1, 2]) },
      { label: 'nums = [2,2,1,1]', input: 'nums = [2, 2, 1, 1]', run: (r) => permutationsUnique(r, [2, 2, 1, 1]) },
    ],
  },
  'medium/backtracking/GenerateParentheses': {
    examples: [
      { label: 'n = 3', input: 'n = 3', run: (r) => generateParenthesis(r, 3) },
      { label: 'n = 2', input: 'n = 2', run: (r) => generateParenthesis(r, 2) },
    ],
  },
  'medium/backtracking/LetterCombinationsOfAPhoneNumber': {
    examples: [
      { label: 'digits = "23"', input: 'digits = "23"', run: (r) => letterCombinations(r, '23') },
      { label: 'digits = "7"', input: 'digits = "7"', run: (r) => letterCombinations(r, '7') },
    ],
  },
  'medium/backtracking/PalindromePartitioning': {
    examples: [
      { label: 's = "aab"', input: 's = "aab"', run: (r) => palindromePartitioning(r, 'aab') },
      { label: 's = "aba"', input: 's = "aba"', run: (r) => palindromePartitioning(r, 'aba') },
    ],
  },
  'medium/backtracking/WordSearch': {
    examples: [
      {
        label: 'word = "ABCCED"',
        input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"',
        run: (r) =>
          wordSearch(
            r,
            [
              ['A', 'B', 'C', 'E'],
              ['S', 'F', 'C', 'S'],
              ['A', 'D', 'E', 'E'],
            ],
            'ABCCED',
          ),
      },
      {
        label: 'word = "ABCB" (not found)',
        input: 'board = [["A","B","C"],["S","F","C"],["A","D","E"]], word = "ABCB"',
        run: (r) =>
          wordSearch(
            r,
            [
              ['A', 'B', 'C'],
              ['S', 'F', 'C'],
              ['A', 'D', 'E'],
            ],
            'ABCB',
          ),
      },
    ],
  },
  'medium/backtracking/MatchsticksToSquare': {
    examples: [
      { label: 'matchsticks = [1,1,1,1] (found)', input: 'matchsticks = [1, 1, 1, 1]', run: (r) => matchsticksToSquare(r, [1, 1, 1, 1]) },
      { label: 'matchsticks = [1,1,1] (sum not ÷4)', input: 'matchsticks = [1, 1, 1]', run: (r) => matchsticksToSquare(r, [1, 1, 1]) },
      { label: 'matchsticks = [2,2] (not found)', input: 'matchsticks = [2, 2]', run: (r) => matchsticksToSquare(r, [2, 2]) },
      {
        label: 'matchsticks = [1,3,4,2,2,4] (found)',
        input: 'matchsticks = [1, 3, 4, 2, 2, 4]',
        run: (r) => matchsticksToSquare(r, [1, 3, 4, 2, 2, 4]),
      },
    ],
  },
  'medium/backtracking/PartitionToKEqualSumSubsets': {
    examples: [
      {
        label: 'nums = [4,3,2,3,5,2,1], k = 4 (found)',
        input: 'nums = [4, 3, 2, 3, 5, 2, 1], k = 4',
        run: (r) => partitionKSubsets(r, [4, 3, 2, 3, 5, 2, 1], 4),
      },
      { label: 'nums = [4,2,4,2,2], k = 2 (not found)', input: 'nums = [4, 2, 4, 2, 2], k = 2', run: (r) => partitionKSubsets(r, [4, 2, 4, 2, 2], 2) },
      { label: 'nums = [1,2,3,4], k = 3 (sum not ÷3)', input: 'nums = [1, 2, 3, 4], k = 3', run: (r) => partitionKSubsets(r, [1, 2, 3, 4], 3) },
    ],
  },
  'medium/backtracking/Combinations': {
    examples: [
      { label: 'n = 4, k = 2', input: 'n = 4, k = 2', run: (r) => combinations(r, 4, 2) },
      { label: 'n = 3, k = 3', input: 'n = 3, k = 3', run: (r) => combinations(r, 3, 3) },
    ],
  },
  'hard/backtracking/NQueens': {
    examples: [
      { label: 'n = 4 (2 solutions)', input: 'n = 4', run: (r) => nQueens(r, 4) },
      { label: 'n = 3 (no solution)', input: 'n = 3', run: (r) => nQueens(r, 3) },
    ],
  },
  'medium/backtracking/SumOfAllSubsetsXORTotal': {
    examples: [
      { label: 'nums = [1,3]', input: 'nums = [1, 3]', run: (r) => subsetXORSum(r, [1, 3]) },
      { label: 'nums = [5,1,6]', input: 'nums = [5, 1, 6]', run: (r) => subsetXORSum(r, [5, 1, 6]) },
    ],
  },
};
