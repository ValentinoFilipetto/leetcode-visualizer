import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, grid } from './helpers';

/** Shared look for "search space" arrays: everything outside [l, r] is dimmed. */
function searchView(
  values: (string | number)[],
  l: number,
  rr: number,
  m: number,
  title: string,
  mState: CellState = 'active',
): Visual {
  return arr(values, {
    title,
    states: values.map((_, i) => (i === m ? mState : i >= l && i <= rr ? ('window' as CellState) : ('muted' as CellState))),
    pointers: [
      { name: 'left', index: l },
      ...(m >= 0 ? [{ name: 'm', index: m, tone: 3 as const, above: false as const }] : []),
      { name: 'right', index: rr, tone: 2 as const },
    ],
  });
}

/* ── Binary Search ────────────────────────────────────────────────────────── */

function binarySearch(r: Recorder, nums: number[], target: number) {
  let left = 0;
  let right = nums.length - 1;

  r.step({
    at: 'int left = 0, right = nums.length - 1;',
    explain: `The array is sorted, so each comparison can throw away half of the remaining range.`,
    vars: { target, left, right },
    visuals: [searchView(nums, left, right, -1, 'nums')],
  });

  while (left <= right) {
    const m = Math.floor((left + right) / 2);
    if (target > nums[m]) {
      r.step({
        at: ['int m = (left + right) / 2;', 'if (target > nums[m]) {', 'left = m + 1;'],
        explain: `nums[${m}] = ${nums[m]} < ${target}, so the target can only be to the right — discard indices ${left}…${m}.`,
        vars: { left, right, m, 'nums[m]': nums[m] },
        visuals: [searchView(nums, left, right, m, 'nums', 'compare')],
      });
      left = m + 1;
    } else if (target < nums[m]) {
      r.step({
        at: ['int m = (left + right) / 2;', '} else if (target < nums[m]) {', 'right = m - 1;'],
        explain: `nums[${m}] = ${nums[m]} > ${target}, so the target can only be to the left — discard indices ${m}…${right}.`,
        vars: { left, right, m, 'nums[m]': nums[m] },
        visuals: [searchView(nums, left, right, m, 'nums', 'compare')],
      });
      right = m - 1;
    } else {
      r.step({
        at: ['int m = (left + right) / 2;', 'return m;'],
        explain: `nums[${m}] = ${target}. Found it in ${Math.ceil(Math.log2(nums.length + 1))} comparisons at most.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums', 'success')],
        tone: 'success',
        result: `return ${m}`,
      });
      return;
    }
  }

  r.step({
    at: 'return -1;',
    explain: `left (${left}) passed right (${right}); the range is empty, so ${target} is not in the array.`,
    vars: { left, right },
    visuals: [arr(nums, { title: 'nums', states: nums.map(() => 'muted' as CellState) })],
    tone: 'error',
    result: 'return -1',
  });
}

/* ── Find Minimum in Rotated Sorted Array ─────────────────────────────────── */

function findMin(r: Recorder, nums: number[]) {
  if (nums[0] < nums[nums.length - 1]) {
    r.step({
      at: 'if (nums[0] < nums[nums.length - 1]) return nums[0];',
      explain: `nums[0] = ${nums[0]} is smaller than the last element, so the array was never rotated and the first element is the minimum.`,
      visuals: [arr(nums, { title: 'nums', states: nums.map((_, i) => (i === 0 ? ('success' as CellState) : undefined)) })],
      tone: 'success',
      result: `return ${nums[0]}`,
    });
    return;
  }

  let left = 0;
  let right = nums.length - 1;
  r.step({
    at: 'int left = 0, right = nums.length - 1;',
    explain:
      'The array is two sorted runs. Comparing the middle with the right end tells us which run the middle belongs to, and the minimum is always at the start of the second run.',
    vars: { left, right },
    visuals: [searchView(nums, left, right, -1, 'nums  (rotated)')],
  });

  while (left < right) {
    const m = Math.floor((left + right) / 2);
    if (nums[m] < nums[right]) {
      r.step({
        at: ['int m = (left + right) / 2;', 'if (nums[m] < nums[right]) {', 'right = m;'],
        explain: `nums[${m}] = ${nums[m]} < nums[${right}] = ${nums[right]}, so the middle is already in the second (smaller) run — the minimum is at m or to its left.`,
        vars: { left, right, m, 'nums[m]': nums[m], 'nums[right]': nums[right] },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      right = m;
    } else {
      r.step({
        at: ['} else if (nums[m] > nums[right]) {', 'left = m + 1;'],
        explain: `nums[${m}] = ${nums[m]} > nums[${right}] = ${nums[right]}, so the middle is still in the first (larger) run — the minimum must be to the right.`,
        vars: { left, right, m, 'nums[m]': nums[m], 'nums[right]': nums[right] },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      left = m + 1;
    }
  }

  r.step({
    at: 'return nums[left];',
    explain: `left and right met at index ${left} — the rotation point, which holds the minimum.`,
    vars: { left, right },
    visuals: [arr(nums, { title: 'nums  (rotated)', states: nums.map((_, i) => (i === left ? ('success' as CellState) : ('muted' as CellState))) })],
    tone: 'success',
    result: `return ${nums[left]}`,
  });
}

/* ── Search in Rotated Sorted Array ───────────────────────────────────────── */

function searchRotated(r: Recorder, nums: number[], target: number) {
  let left = 0;
  let right = nums.length - 1;

  r.step({
    at: 'int left = 0, right = nums.length - 1;',
    explain: 'Phase 1: find the pivot — the index of the smallest element — exactly as in "Find Minimum in Rotated Sorted Array".',
    vars: { target, left, right },
    visuals: [searchView(nums, left, right, -1, 'nums  (rotated)')],
  });

  while (left < right) {
    const m = Math.floor((left + right) / 2);
    if (nums[m] > nums[right]) {
      r.step({
        at: ['if (nums[m] > nums[right]) {', 'left = m + 1;'],
        explain: `nums[${m}] = ${nums[m]} > nums[${right}] = ${nums[right]} — the middle sits in the left run, so the pivot is further right.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      left = m + 1;
    } else {
      r.step({
        at: ['} else {', 'right = m;'],
        explain: `nums[${m}] = ${nums[m]} ≤ nums[${right}] = ${nums[right]} — the middle is in the right run, so the pivot is at m or before it.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      right = m;
    }
  }

  const pivot = left;
  left = 0;
  right = nums.length - 1;
  r.step({
    at: 'int pivot = left;',
    explain: `Pivot found at index ${pivot} (value ${nums[pivot]}). Both nums[0…${pivot - 1}] and nums[${pivot}…${nums.length - 1}] are sorted.`,
    vars: { pivot, 'nums[pivot]': nums[pivot] },
    visuals: [
      arr(nums, {
        title: 'nums  (rotated)',
        states: nums.map((_, i) => (i === pivot ? ('done' as CellState) : i < pivot ? ('window' as CellState) : ('compare' as CellState))),
        pointers: [{ name: 'pivot', index: pivot, tone: 4 }],
      }),
    ],
  });

  if (target >= nums[pivot] && target <= nums[right]) {
    left = pivot;
    r.step({
      at: ['if (target >= nums[pivot] && target <= nums[right]) {', 'left = pivot;'],
      explain: `${target} lies between nums[${pivot}] = ${nums[pivot]} and nums[${right}] = ${nums[right]}, so search the right run.`,
      vars: { target, left, right },
      visuals: [searchView(nums, left, right, -1, 'nums  (rotated)')],
    });
  } else {
    right = pivot - 1;
    r.step({
      at: ['} else {', 'right = pivot - 1;'],
      explain: `${target} is outside the right run, so search the left run nums[0…${right}].`,
      vars: { target, left, right },
      visuals: [searchView(nums, left, right, -1, 'nums  (rotated)')],
    });
  }

  while (left <= right) {
    const m = Math.floor((left + right) / 2);
    if (target > nums[m]) {
      r.step({
        at: ['if (target > nums[m]) {', 'left = m + 1;@2'],
        explain: `nums[${m}] = ${nums[m]} < ${target} — go right.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      left = m + 1;
    } else if (target < nums[m]) {
      r.step({
        at: ['} else if (target < nums[m]) {', 'right = m - 1;'],
        explain: `nums[${m}] = ${nums[m]} > ${target} — go left.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'compare')],
      });
      right = m - 1;
    } else {
      r.step({
        at: 'return m;',
        explain: `Found ${target} at index ${m}.`,
        vars: { left, right, m },
        visuals: [searchView(nums, left, right, m, 'nums  (rotated)', 'success')],
        tone: 'success',
        result: `return ${m}`,
      });
      return;
    }
  }

  r.step({
    at: 'return -1;',
    explain: `${target} is not present in either run.`,
    visuals: [arr(nums, { title: 'nums  (rotated)', states: nums.map(() => 'muted' as CellState) })],
    tone: 'error',
    result: 'return -1',
  });
}

/* ── Koko Eating Bananas ──────────────────────────────────────────────────── */

function kokoEatingBananas(r: Recorder, piles: number[], h: number) {
  const max = Math.max(...piles);
  let left = 1;
  let right = max;
  let res = right;

  const hoursFor = (rate: number) => piles.reduce((sum, p) => sum + Math.ceil(p / rate), 0);
  const rates = Array.from({ length: max }, (_, i) => i + 1);

  const view = (m: number, state: CellState): Visual[] => [
    {
      kind: 'bars',
      title: 'piles',
      values: piles,
      states: piles.map(() => undefined),
      overlays: m > 0 ? piles.map((p, i) => ({ index: i, from: 0, to: Math.min(m, p), tone: 'area' as const, label: `${Math.ceil(p / m)}h` })) : [],
      note: m > 0 ? `at rate ${m} bananas/hour the piles take ${hoursFor(m)} hours in total (limit ${h})` : '',
    },
    arr(rates, {
      title: 'candidate eating rates',
      states: rates.map((v) => (v === m ? state : v >= left && v <= right ? ('window' as CellState) : ('muted' as CellState))),
      labels: rates.map(() => ''),
      indexed: false,
      pointers: [
        { name: 'left', index: left - 1 },
        ...(m > 0 ? [{ name: 'rate', index: m - 1, tone: 3 as const, above: false as const }] : []),
        { name: 'right', index: right - 1, tone: 2 as const },
      ],
    }),
  ];

  r.step({
    at: ['int left = 1;', 'int right = Arrays.stream(piles).max().getAsInt();'],
    explain:
      'Binary search over the answer, not the array: any rate from 1 to the biggest pile is a candidate, and "can Koko finish in h hours at rate x" is monotonic — false, false, …, true, true.',
    vars: { h, left, right, res },
    visuals: view(0, 'idle'),
  });

  while (left <= right) {
    const rate = Math.floor((left + right) / 2);
    const hours = hoursFor(rate);
    if (hours > h) {
      r.step({
        at: ['int rate = (left + right) / 2;', 'if (hoursRequired > h) {', 'left = rate + 1;'],
        explain: `At ${rate} bananas/hour Koko needs ${hours} hours — more than ${h}. Too slow, so try faster rates.`,
        vars: { left, right, rate, hoursRequired: hours, h, res },
        visuals: view(rate, 'error'),
        tone: 'warn',
      });
      left = rate + 1;
    } else {
      res = Math.min(res, rate);
      r.step({
        at: ['int rate = (left + right) / 2;', 'right = rate - 1;', 'res = Math.min(res, rate);'],
        explain: `At ${rate} bananas/hour Koko needs ${hours} hours ≤ ${h}. That works — record it and look for an even slower rate.`,
        vars: { left, right, rate, hoursRequired: hours, h, res },
        visuals: view(rate, 'success'),
        tone: 'success',
      });
      right = rate - 1;
    }
  }

  r.step({
    at: 'return res;',
    explain: `The slowest rate that still fits in ${h} hours is ${res}.`,
    vars: { res },
    visuals: view(res, 'success'),
    tone: 'success',
    result: `return ${res}`,
  });
}

/* ── Search a 2D Matrix ───────────────────────────────────────────────────── */

function searchMatrix(r: Recorder, matrix: number[][], target: number) {
  let indexToSearch = -1;

  r.step({
    at: 'int indexToSearch = -1;',
    explain: 'Each row is sorted and rows increase downwards, so first find the one row whose range could contain the target.',
    vars: { target },
    visuals: [grid(matrix, { title: 'matrix' })],
  });

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    const fits = row[0] <= target && target <= row[row.length - 1];
    if (fits) indexToSearch = i;
    r.step({
      at: 'if (subarray[0] <= target && target <= subarray[subarray.length - 1]) {',
      explain: `Row ${i} spans ${row[0]}…${row[row.length - 1]} — ${fits ? `${target} could be here.` : `${target} cannot be here.`}`,
      vars: { i, 'subarray[0]': row[0], last: row[row.length - 1], indexToSearch },
      visuals: [
        grid(matrix, {
          title: 'matrix',
          states: matrix.map((rw, ri) => rw.map(() => (ri === i ? (fits ? ('success' as CellState) : ('error' as CellState)) : undefined))),
        }),
      ],
      tone: fits ? 'success' : 'neutral',
    });
  }

  if (indexToSearch === -1) {
    r.step({
      at: 'if (indexToSearch == -1) return false;',
      explain: `No row covers ${target}.`,
      visuals: [grid(matrix, { title: 'matrix', states: matrix.map((rw) => rw.map(() => 'muted' as CellState)) })],
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  const row = matrix[indexToSearch];
  let left = 0;
  let right = row.length - 1;
  r.step({
    at: 'int left = 0, right = matrix[indexToSearch].length - 1;',
    explain: `Row ${indexToSearch} is sorted, so binary search it.`,
    vars: { indexToSearch, left, right },
    visuals: [
      grid(matrix, {
        title: 'matrix',
        states: matrix.map((rw, ri) => rw.map(() => (ri === indexToSearch ? ('window' as CellState) : ('muted' as CellState)))),
      }),
      searchView(row, left, right, -1, `matrix[${indexToSearch}]`),
    ],
  });

  while (left <= right) {
    const m = Math.floor((left + right) / 2);
    if (target > row[m]) {
      r.step({
        at: ['if (target > matrix[indexToSearch][m]) {', 'left = m + 1;'],
        explain: `${row[m]} < ${target} — search the right half of the row.`,
        vars: { left, right, m, value: row[m] },
        visuals: [searchView(row, left, right, m, `matrix[${indexToSearch}]`, 'compare')],
      });
      left = m + 1;
    } else if (target < row[m]) {
      r.step({
        at: ['} else if (target < matrix[indexToSearch][m]) {', 'right = m - 1;'],
        explain: `${row[m]} > ${target} — search the left half of the row.`,
        vars: { left, right, m, value: row[m] },
        visuals: [searchView(row, left, right, m, `matrix[${indexToSearch}]`, 'compare')],
      });
      right = m - 1;
    } else {
      r.step({
        at: 'return true;',
        explain: `${target} found at matrix[${indexToSearch}][${m}].`,
        vars: { left, right, m },
        visuals: [
          grid(matrix, {
            title: 'matrix',
            cursor: [indexToSearch, m],
            states: matrix.map((rw, ri) => rw.map((_, ci) => (ri === indexToSearch && ci === m ? ('success' as CellState) : undefined))),
          }),
          searchView(row, left, right, m, `matrix[${indexToSearch}]`, 'success'),
        ],
        tone: 'success',
        result: 'return true',
      });
      return;
    }
  }

  r.step({
    at: 'return false;@2',
    explain: `The row was exhausted without finding ${target}.`,
    visuals: [searchView(row, left, right, -1, `matrix[${indexToSearch}]`)],
    tone: 'error',
    result: 'return false',
  });
}

/* ── Time Based Key-Value Store ───────────────────────────────────────────── */

type TimeOp = ['set', string, string, number] | ['get', string, number];

function timeStore(r: Recorder, ops: TimeOp[]) {
  const map = new Map<string, { name: string; timestamp: number }[]>();
  const listViz = (key: string, l = -1, rr = -1, m = -1, mState: CellState = 'active'): Visual => {
    const entries = map.get(key) ?? [];
    return arr(
      entries.map((e) => `${e.name}@${e.timestamp}`),
      {
        title: `map["${key}"]  (append-only, so timestamps are sorted)`,
        states: entries.map((_, i) => (i === m ? mState : l >= 0 && i >= l && i <= rr ? ('window' as CellState) : l >= 0 ? ('muted' as CellState) : undefined)),
        pointers:
          l >= 0
            ? [
                { name: 'left', index: l },
                ...(m >= 0 ? [{ name: 'middle', index: m, tone: 3 as const, above: false as const }] : []),
                { name: 'right', index: rr, tone: 2 as const },
              ]
            : [],
      },
    );
  };

  r.step({
    at: 'this.map = new HashMap<>();',
    explain: 'Every key keeps its own list of (value, timestamp) pairs. Because set() is called with increasing timestamps, each list is already sorted.',
    visuals: [],
  });

  for (const op of ops) {
    if (op[0] === 'set') {
      const [, key, value, ts] = op;
      const entries = map.get(key) ?? [];
      entries.push({ name: value, timestamp: ts });
      map.set(key, entries);
      r.step({
        at: 'this.map.computeIfAbsent(key, k -> new ArrayList<>()).add(',
        explain: `set("${key}", "${value}", ${ts}) appends to the list for "${key}" — O(1), no sorting required.`,
        vars: { key, value, timestamp: ts },
        visuals: [listViz(key)],
      });
      continue;
    }

    const [, key, ts] = op;
    if (!map.has(key)) {
      r.step({
        at: 'if (!this.map.containsKey(key)) return "";',
        explain: `get("${key}", ${ts}): the key was never set.`,
        vars: { key, timestamp: ts },
        visuals: [],
        tone: 'warn',
        result: 'return ""',
      });
      continue;
    }

    const entries = map.get(key)!;
    let left = 0;
    let right = entries.length - 1;
    let res = '';
    r.step({
      at: ['int left = 0, right = list.size() - 1;', 'String res = ""; // Use a variable to track the "closest" valid name'],
      explain: `get("${key}", ${ts}) needs the newest entry whose timestamp is ≤ ${ts} — a binary search for the rightmost valid entry.`,
      vars: { key, timestamp: ts, left, right },
      visuals: [listViz(key, left, right, -1)],
    });

    while (left <= right) {
      const middle = left + Math.floor((right - left) / 2);
      const entry = entries[middle];
      if (entry.timestamp <= ts) {
        res = entry.name;
        r.step({
          at: ['if (list.get(middle).timestamp() <= timestamp) {', 'res = list.get(middle).name();'],
          explain: `Entry ${middle} has timestamp ${entry.timestamp} ≤ ${ts} — it is valid, so remember "${entry.name}" and look for something even newer.`,
          vars: { left, right, middle, res },
          visuals: [listViz(key, left, right, middle, 'success')],
          tone: 'success',
        });
        left = middle + 1;
      } else {
        r.step({
          at: ['} else {', 'right = middle - 1; // Too big, look left'],
          explain: `Entry ${middle} has timestamp ${entry.timestamp} > ${ts} — too new, discard it and everything to its right.`,
          vars: { left, right, middle, res },
          visuals: [listViz(key, left, right, middle, 'error')],
        });
        right = middle - 1;
      }
    }

    r.step({
      at: 'return res;',
      explain: res ? `The newest value at or before ${ts} is "${res}".` : `Every entry is newer than ${ts}, so there is no valid value.`,
      vars: { res: `"${res}"` },
      visuals: [listViz(key)],
      tone: res ? 'success' : 'warn',
      result: `get("${key}", ${ts}) = "${res}"`,
    });
  }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const binarySearchTracers: Record<string, Tracer> = {
  'easy/binarysearch/BinarySearch': {
    examples: [
      { label: 'target present', input: 'nums = [-1, 0, 2, 4, 6, 8], target = 4', run: (r) => binarySearch(r, [-1, 0, 2, 4, 6, 8], 4) },
      { label: 'target missing', input: 'nums = [-1, 0, 2, 4, 6, 8], target = 3', run: (r) => binarySearch(r, [-1, 0, 2, 4, 6, 8], 3) },
    ],
  },
  'medium/binarysearch/FindMinimumInRotatedSortedArray': {
    examples: [
      { label: 'nums = [4,5,6,7,0,1,2]', input: 'nums = [4, 5, 6, 7, 0, 1, 2]', run: (r) => findMin(r, [4, 5, 6, 7, 0, 1, 2]) },
      { label: 'not rotated', input: 'nums = [1, 2, 3, 4]', run: (r) => findMin(r, [1, 2, 3, 4]) },
    ],
  },
  'medium/binarysearch/SearchInRotatedSortedArray': {
    examples: [
      { label: 'target = 0', input: 'nums = [4, 5, 6, 7, 0, 1, 2], target = 0', run: (r) => searchRotated(r, [4, 5, 6, 7, 0, 1, 2], 0) },
      { label: 'target = 6', input: 'nums = [4, 5, 6, 7, 0, 1, 2], target = 6', run: (r) => searchRotated(r, [4, 5, 6, 7, 0, 1, 2], 6) },
      { label: 'target missing', input: 'nums = [4, 5, 6, 7, 0, 1, 2], target = 3', run: (r) => searchRotated(r, [4, 5, 6, 7, 0, 1, 2], 3) },
    ],
  },
  'medium/binarysearch/KokoEatingBananas': {
    examples: [
      { label: 'piles = [3,6,7,11], h = 8', input: 'piles = [3, 6, 7, 11], h = 8', run: (r) => kokoEatingBananas(r, [3, 6, 7, 11], 8) },
      { label: 'piles = [25,10,23,4], h = 4', input: 'piles = [25, 10, 23, 4], h = 4', run: (r) => kokoEatingBananas(r, [25, 10, 23, 4], 4) },
    ],
  },
  'medium/binarysearch/SearchA2DMatrix': {
    examples: [
      {
        label: 'target = 10',
        input: 'matrix = [[1,2,4,8],[10,11,12,13],[14,20,30,40]], target = 10',
        run: (r) => searchMatrix(r, [[1, 2, 4, 8], [10, 11, 12, 13], [14, 20, 30, 40]], 10),
      },
      {
        label: 'target = 15',
        input: 'matrix = [[1,2,4,8],[10,11,12,13],[14,20,30,40]], target = 15',
        run: (r) => searchMatrix(r, [[1, 2, 4, 8], [10, 11, 12, 13], [14, 20, 30, 40]], 15),
      },
    ],
  },
  'medium/binarysearch/TimeBasedKeyValueStore': {
    examples: [
      {
        label: 'set × 3, then three gets',
        input: 'set("alice","happy",1), set("alice","sad",3), get("alice",1), get("alice",2), get("alice",5), get("bob",1)',
        run: (r) =>
          timeStore(r, [
            ['set', 'alice', 'happy', 1],
            ['set', 'alice', 'sad', 3],
            ['get', 'alice', 1],
            ['get', 'alice', 2],
            ['get', 'alice', 5],
            ['get', 'bob', 1],
          ]),
      },
    ],
  },
};
