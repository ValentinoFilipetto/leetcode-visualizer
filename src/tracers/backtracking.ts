import type { Recorder } from '../trace/recorder';
import type { CellState, DecisionTreeNodeViz, TextViz, Tracer, Visual } from '../types';
import { arr, chars, chips, decisionTree, frames, grid, list } from './helpers';

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
  const calls: string[] = [];

  const view = (i: number, state: CellState = 'active'): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, k) => (k === i ? state : subset.includes(nums[k]) && k < i ? ('success' as CellState) : k < i ? ('muted' as CellState) : undefined)),
      pointers: i < nums.length ? [{ name: 'i', index: i }] : [],
    }),
    arr(subset, { title: 'subset  (current branch)', states: subset.map(() => 'window' as CellState) }),
    frames('call stack', calls.slice().reverse()),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'dfs(nums, 0, new ArrayList<>(), res);',
    explain: 'Each element has exactly two fates: left out or taken. Walking that binary decision tree yields all 2ⁿ subsets.',
    visuals: view(0),
  });

  const dfs = (i: number) => {
    calls.push(`dfs(i=${i}, subset=[${subset.join(',')}])`);
    if (i === nums.length) {
      res.push(subset.slice());
      r.step({
        at: ['if (i == nums.length) {', 'res.add(new ArrayList<>(subset));'],
        explain: `Every element has been decided — record a copy of [${subset.join(', ')}]. The copy matters: the list itself keeps mutating.`,
        vars: { i, subset: list(subset) },
        visuals: view(i, 'done'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    subset.push(nums[i]);
    r.step({
      at: ['subset.add(nums[i]);', 'dfs(nums, i + 1, subset, res);@1'],
      explain: `Branch 1 — take ${nums[i]}.`,
      vars: { i, 'nums[i]': nums[i], subset: list(subset) },
      visuals: view(i, 'success'),
    });
    dfs(i + 1);

    subset.pop();
    r.step({
      at: 'subset.remove(subset.size() - 1);',
      explain: `Both descendants of taking ${nums[i]} are explored — undo the choice so the caller sees the list exactly as it left it.`,
      vars: { i, subset: list(subset) },
      visuals: view(i, 'compare'),
      tone: 'warn',
    });

    r.step({
      at: 'dfs(nums, i + 1, subset, res);@2',
      explain: `Branch 2 — leave ${nums[i]} out.`,
      vars: { i, 'nums[i]': nums[i], subset: list(subset) },
      visuals: view(i, 'muted'),
    });
    dfs(i + 1);

    calls.pop();
  };

  dfs(0);
  r.step({
    at: 'return res;',
    explain: `${res.length} subsets = 2^${nums.length}.`,
    visuals: [resultsViz('res', res.map((s) => `[${s.join(', ')}]`))],
    tone: 'success',
    result: `return ${res.length} subsets`,
  });
}

/* ── Subsets II ───────────────────────────────────────────────────────────── */

function subsetsII(r: Recorder, input: number[]) {
  const nums = input.slice().sort((a, b) => a - b);
  const res: number[][] = [];
  const subset: number[] = [];
  const calls: string[] = [];

  const view = (i: number, state: CellState = 'active'): Visual[] => [
    arr(nums, {
      title: 'nums  (sorted, so duplicates are adjacent)',
      states: nums.map((_, k) => (k === i ? state : undefined)),
      pointers: i < nums.length ? [{ name: 'i', index: i }] : [],
    }),
    arr(subset, { title: 'subset', states: subset.map(() => 'window' as CellState) }),
    frames('call stack', calls.slice().reverse()),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'Arrays.sort(nums);',
    explain: `Sorting groups duplicates together: ${list(input)} → ${list(nums)}. That is what makes skipping them possible.`,
    visuals: view(0),
  });

  const dfs = (i: number) => {
    calls.push(`dfs(i=${i})`);
    if (i === nums.length) {
      res.push(subset.slice());
      r.step({
        at: 'res.add(new ArrayList<>(subset));',
        explain: `Record [${subset.join(', ')}].`,
        vars: { i, subset: list(subset) },
        visuals: view(i, 'done'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    subset.push(nums[i]);
    r.step({
      at: ['subset.add(nums[i]);', 'dfs(nums, i + 1, subset);@1'],
      explain: `Take ${nums[i]} and continue.`,
      vars: { i, subset: list(subset) },
      visuals: view(i, 'success'),
    });
    dfs(i + 1);
    subset.pop();

    let j = i;
    while (j + 1 < nums.length && nums[j] === nums[j + 1]) j++;
    if (j !== i) {
      r.step({
        at: 'while (i + 1 < nums.length && nums[i] == nums[i + 1]) i++;',
        explain: `Before the "skip" branch, jump past the copies of ${nums[i]} (indices ${i}…${j}). Skipping one copy but not the others would produce the same subset twice.`,
        vars: { i: j, value: nums[i] },
        visuals: view(j, 'error'),
        tone: 'warn',
      });
    }

    r.step({
      at: 'dfs(nums, i + 1, subset);@2',
      explain: `Skip branch — continue without ${nums[i]}.`,
      vars: { i: j, subset: list(subset) },
      visuals: view(j, 'muted'),
    });
    dfs(j + 1);
    calls.pop();
  };

  dfs(0);
  r.step({
    at: 'return res;',
    explain: `${res.length} distinct subsets, each produced exactly once.`,
    visuals: [resultsViz('res', res.map((s) => `[${s.join(', ')}]`))],
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
  const calls: string[] = [];

  const view = (i: number, state: CellState = 'active'): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, k) => (k === i ? state : pick[k] ? ('success' as CellState) : undefined)),
      labels: nums.map((_, k) => (pick[k] ? 'used' : 'free')),
      indexed: false,
    }),
    arr(permutation, { title: 'permutation', states: permutation.map(() => 'window' as CellState) }),
    frames('call stack', calls.slice().reverse()),
    resultsViz('res', res.map((s) => `[${s.join(', ')}]`)),
  ];

  r.step({
    at: 'backtrack(nums, new boolean[nums.length], new ArrayList<>());',
    explain: 'The boolean array records which values are already in the current permutation, so each level only picks from the free ones.',
    visuals: view(-1),
  });

  const dfs = () => {
    calls.push(`backtrack([${permutation.join(',')}])`);
    if (permutation.length === nums.length) {
      res.push(permutation.slice());
      r.step({
        at: ['if (perm.size() == nums.length) {', 'res.add(new ArrayList<>(perm));'],
        explain: `All ${nums.length} values are used — [${permutation.join(', ')}] is a complete permutation.`,
        vars: { permutation: list(permutation) },
        visuals: view(-1, 'done'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (pick[i]) continue;
      permutation.push(nums[i]);
      pick[i] = true;
      r.step({
        at: ['perm.add(nums[i]);', 'pick[i] = true;'],
        explain: `Place ${nums[i]} at position ${permutation.length - 1}.`,
        vars: { i, permutation: list(permutation) },
        visuals: view(i, 'success'),
      });
      dfs();
      permutation.pop();
      pick[i] = false;
      r.step({
        at: ['perm.remove(perm.size() - 1);', 'pick[i] = false;'],
        explain: `Backtrack: free ${nums[i]} again so other branches can use it.`,
        vars: { i, permutation: list(permutation) },
        visuals: view(i, 'compare'),
        tone: 'warn',
      });
    }
    calls.pop();
  };

  dfs();
  r.step({
    at: 'return res;',
    explain: `${res.length} permutations = ${nums.length}!.`,
    visuals: [resultsViz('res', res.map((s) => `[${s.join(', ')}]`))],
    tone: 'success',
    result: `return ${res.length} permutations`,
  });
}

/* ── Generate Parentheses ─────────────────────────────────────────────────── */

function generateParenthesis(r: Recorder, n: number) {
  const res: string[] = [];
  const calls: string[] = [];

  const view = (s: string, open: number, closed: number, state: CellState = 'active'): Visual[] => [
    arr(chars(s), { title: 'string', states: chars(s).map(() => state), indexed: false }),
    arr([open, closed, n], { title: 'counters', labels: ['numberOpen', 'numberClosed', 'n'], indexed: false }),
    frames('call stack', calls.slice().reverse()),
    resultsViz('res', res.map((x) => `"${x}"`)),
  ];

  r.step({
    at: 'dfs(n, "", 0, 0);',
    explain: `Build the string one character at a time, obeying two rules: never more than ${n} "(", and never more ")" than "(".`,
    vars: { n },
    visuals: view('', 0, 0, 'idle'),
  });

  const dfs = (s: string, open: number, closed: number) => {
    calls.push(`dfs("${s}", ${open}, ${closed})`);
    if (n === open && open === closed) {
      res.push(s);
      r.step({
        at: ['if (n == numberOpen && numberOpen == numberClosed) {', 'res.add(string);'],
        explain: `"${s}" uses all ${n} pairs and is balanced.`,
        vars: { string: `"${s}"`, numberOpen: open, numberClosed: closed },
        visuals: view(s, open, closed, 'success'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    if (open < n) {
      r.step({
        at: ['if (numberOpen < n) {', "dfs(n, string + '(', numberOpen + 1, numberClosed);"],
        explain: `Only ${open} of ${n} opening brackets used, so "(" is allowed.`,
        vars: { string: `"${s}"`, numberOpen: open, numberClosed: closed },
        visuals: view(s + '(', open + 1, closed),
      });
      dfs(s + '(', open + 1, closed);
    }

    if (closed + 1 <= open) {
      r.step({
        at: ['if (numberClosed + 1 <= numberOpen) {', "dfs(n, string + ')', numberOpen, numberClosed + 1);"],
        explain: `There are ${open - closed} unmatched "(" open, so ")" keeps the string valid.`,
        vars: { string: `"${s}"`, numberOpen: open, numberClosed: closed },
        visuals: view(s + ')', open, closed + 1),
      });
      dfs(s + ')', open, closed + 1);
    } else if (open >= n) {
      r.step({
        at: 'if (numberClosed + 1 <= numberOpen) {',
        explain: `Neither branch is legal from "${s}" — this path is finished.`,
        vars: { string: `"${s}"`, numberOpen: open, numberClosed: closed },
        visuals: view(s, open, closed, 'muted'),
      });
    }
    calls.pop();
  };

  dfs('', 0, 0);
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
  const calls: string[] = [];

  const view = (i: number, state: CellState = 'active'): Visual[] => [
    arr(chars(digits), {
      title: 'digits',
      states: chars(digits).map((_, k) => (k === i ? state : k < i ? ('visited' as CellState) : undefined)),
      pointers: i < digits.length ? [{ name: 'i', index: i }] : [],
    }),
    ...(i < digits.length
      ? [arr(KEYPAD[digits[i]] ?? [], { title: `KEYPAD['${digits[i]}']`, indexed: false })]
      : []),
    arr(combination, { title: 'combination', states: combination.map(() => 'window' as CellState), indexed: false }),
    frames('call stack', calls.slice().reverse()),
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
    explain: 'One recursion level per digit; the loop inside tries every letter on that key.',
    visuals: view(0),
  });

  const backtracking = (i: number) => {
    calls.push(`backtracking(i=${i})`);
    if (i === digits.length) {
      res.push(combination.join(''));
      r.step({
        at: ['if (i == digits.length()) {', 'res.add(combination.toString());'],
        explain: `Every digit has a letter: "${combination.join('')}".`,
        vars: { combination: `"${combination.join('')}"` },
        visuals: view(i, 'done'),
        tone: 'success',
      });
      calls.pop();
      return;
    }

    for (const ch of KEYPAD[digits[i]]) {
      combination.push(ch);
      r.step({
        at: ['combination.append(character);', 'backtracking(i + 1, digits, combination);'],
        explain: `Digit '${digits[i]}' → try '${ch}'.`,
        vars: { i, character: ch, combination: `"${combination.join('')}"` },
        visuals: view(i, 'active'),
      });
      backtracking(i + 1);
      combination.pop();
      r.step({
        at: 'combination.deleteCharAt(combination.length() - 1);',
        explain: `Remove '${ch}' again — a StringBuilder is mutable, so the undo has to be explicit.`,
        vars: { i, combination: `"${combination.join('')}"` },
        visuals: view(i, 'compare'),
        tone: 'warn',
      });
    }
    calls.pop();
  };

  backtracking(0);
  r.step({
    at: 'return res;@2',
    explain: `${res.length} combinations.`,
    visuals: [resultsViz('res', res.map((x) => `"${x}"`))],
    tone: 'success',
    result: `return [${res.map((x) => `"${x}"`).join(', ')}]`,
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
        at: 'board[r][c] = temp; // restore original char.',
        explain: `No direction from (${rr}, ${cc}) completed the word — restore '${temp}' so other paths can use this cell.`,
        vars: { r: rr, c: cc, i },
        visuals: view(rr, cc, i, 'compare'),
        tone: 'warn',
      });
    }
    return found;
  };

  r.step({
    at: 'if (board[r][c] == word.charAt(0) && backtrack(board, r, c, word, 0)) {',
    explain: `Try to start the search only at cells holding '${word[0]}', the first character of "${word}".`,
    visuals: view(-1, -1, 0, 'idle'),
  });

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (board[rr][cc] !== word[0]) continue;
      r.step({
        at: 'if (board[r][c] == word.charAt(0) && backtrack(board, r, c, word, 0)) {',
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
  'medium/backtracking/SumOfAllSubsetsXORTotal': {
    examples: [
      { label: 'nums = [1,3]', input: 'nums = [1, 3]', run: (r) => subsetXORSum(r, [1, 3]) },
      { label: 'nums = [5,1,6]', input: 'nums = [5, 1, 6]', run: (r) => subsetXORSum(r, [5, 1, 6]) },
    ],
  },
};
