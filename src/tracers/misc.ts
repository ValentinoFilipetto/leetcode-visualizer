import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, bars, chars, list, setOf } from './helpers';

/* ── Best Time to Buy and Sell Stock ──────────────────────────────────────── */

function maxProfit(r: Recorder, prices: number[]) {
  let left = 0;
  let maxSoFar = 0;

  const view = (right: number, state: CellState, profit?: number): Visual[] => [
    bars(prices, {
      title: 'prices',
      states: prices.map((_, i) => (i === right ? state : i === left ? ('window' as CellState) : i < left ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'buy', index: left, tone: 3 },
        { name: 'sell', index: right, tone: 2 },
      ],
      overlays:
        profit !== undefined && profit > 0
          ? [{ index: left, span: right - left + 1, from: prices[left], to: prices[right], tone: 'area', label: `+${profit}` }]
          : [],
      note: `best profit so far: ${maxSoFar}`,
    }),
  ];

  r.step({
    at: 'int left = 0, maxSoFar = 0;',
    explain: 'left is the cheapest day seen so far — the day we would have bought. right walks forward looking for the best day to sell.',
    vars: { left, maxSoFar },
    visuals: view(0, 'idle'),
  });

  for (let right = 0; right < prices.length; right++) {
    if (prices[right] <= prices[left]) {
      r.step({
        at: 'if (prices[right] <= prices[left]) left = right;',
        explain: `Day ${right} costs ${prices[right]}, which is no more than the current buy price ${prices[left]} — buying here can only be better, so move left.`,
        vars: { right, 'prices[right]': prices[right], 'prices[left]': prices[left], maxSoFar },
        visuals: view(right, 'compare'),
      });
      left = right;
    } else {
      const profit = prices[right] - prices[left];
      const improved = profit > maxSoFar;
      maxSoFar = Math.max(maxSoFar, profit);
      r.step({
        at: ['int profit = prices[right] - prices[left];', 'maxSoFar = Math.max(maxSoFar, profit);'],
        explain: `Selling on day ${right} at ${prices[right]} after buying on day ${left} at ${prices[left]} earns ${profit}.${improved ? ' Best so far.' : ''}`,
        vars: { left, right, profit, maxSoFar },
        visuals: view(right, 'success', profit),
        tone: improved ? 'success' : 'neutral',
      });
    }
  }

  r.step({
    at: 'return maxSoFar;',
    explain: `One pass, no extra memory: the best achievable profit is ${maxSoFar}.`,
    vars: { maxSoFar },
    visuals: [bars(prices, { title: 'prices' })],
    tone: 'success',
    result: `return ${maxSoFar}`,
  });
}

/* ── Happy Number ─────────────────────────────────────────────────────────── */

function isHappy(r: Recorder, start: number) {
  const seen = new Set<number>();
  let n = start;

  const view = (state: CellState, digits?: number[]): Visual[] => [
    ...(digits ? [arr(digits, { title: `digits of ${n}`, labels: digits.map((d) => `${d}² = ${d * d}`), indexed: false })] : []),
    {
      ...setOf('seen', seen),
      entries: [...seen].map((key) => ({ key, state: key === n ? state : undefined })),
    },
  ];

  r.step({
    at: 'Set<Integer> seen = new HashSet<>();',
    explain:
      'Replace the number by the sum of the squares of its digits, over and over. Either it reaches 1, or it enters a cycle — and a set is what detects the cycle.',
    vars: { n },
    visuals: view('idle'),
  });

  while (!seen.has(n)) {
    seen.add(n);
    const digits = String(n).split('').map(Number);
    const next = digits.reduce((sum, d) => sum + d * d, 0);
    r.step({
      at: ['seen.add(n);', 'n = sumOfSquares(n);'],
      explain: `${n} → ${digits.map((d) => `${d}²`).join(' + ')} = ${next}.`,
      vars: { n, next },
      visuals: view('active', digits),
    });
    n = next;
    if (n === 1) {
      r.step({
        at: 'if (n == 1) return true;',
        explain: 'Reaching 1 means the number is happy.',
        vars: { n },
        visuals: view('success'),
        tone: 'success',
        result: 'return true',
      });
      return;
    }
  }

  r.step({
    at: 'return false;',
    explain: `${n} has already been seen, so the sequence is looping forever and can never reach 1.`,
    vars: { n },
    visuals: [
      {
        ...setOf('seen', seen),
        entries: [...seen].map((key) => ({ key, state: key === n ? ('error' as CellState) : undefined })),
      },
    ],
    tone: 'error',
    result: 'return false',
  });
}

/* ── Longest Common Prefix ────────────────────────────────────────────────── */

function longestCommonPrefix(r: Recorder, strs: string[]) {
  let index = 0;

  const view = (i: number, badRow: number, state: CellState): Visual[] =>
    strs.map((s, row) =>
      arr(chars(s), {
        title: row === 0 ? 'strs[0]  (the reference string)' : `strs[${row}]`,
        states: chars(s).map((_, k) => (k < i ? ('success' as CellState) : k === i ? (row === badRow ? 'error' : state) : undefined)),
      }),
    );

  r.step({
    at: 'int index = 0;',
    explain: 'Vertical scanning: compare the character at the same position across every string, and stop at the first disagreement.',
    visuals: view(0, -1, 'active'),
  });

  for (;;) {
    if (index >= strs[0].length) {
      r.step({
        at: 'if (index >= strs[0].length()) return strs[0].substring(0, index);',
        explain: `The first string ran out, so it is itself the common prefix: "${strs[0]}".`,
        vars: { index },
        visuals: view(index, -1, 'success'),
        tone: 'success',
        result: `return "${strs[0].slice(0, index)}"`,
      });
      return;
    }

    const curr = strs[0][index];
    for (let row = 0; row < strs.length; row++) {
      const s = strs[row];
      if (index >= s.length || s[index] !== curr) {
        r.step({
          at: ['if (index >= s.length() || s.charAt(index) != curr) {', 'return strs[0].substring(0, index);@2'],
          explain:
            index >= s.length
              ? `"${s}" is only ${s.length} characters long, so the prefix cannot grow past ${index}.`
              : `"${s}" has '${s[index]}' at position ${index}, not '${curr}' — the prefix stops here.`,
          vars: { index, curr, mismatch: s },
          visuals: view(index, row, 'compare'),
          tone: 'warn',
          result: `return "${strs[0].slice(0, index)}"`,
        });
        return;
      }
    }

    r.step({
      at: 'index++;',
      explain: `Every string has '${curr}' at position ${index} — the prefix is now "${strs[0].slice(0, index + 1)}".`,
      vars: { index, curr },
      visuals: view(index, -1, 'success'),
      tone: 'success',
    });
    index++;
  }
}

/* ── Majority Element (Boyer-Moore) ───────────────────────────────────────── */

function majorityElement(r: Recorder, nums: number[]) {
  let res = 0;
  let count = 0;

  const view = (i: number, state: CellState): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, k) => (k === i ? state : k < i ? (nums[k] === res ? ('success' as CellState) : ('muted' as CellState)) : undefined)),
      pointers: [{ name: 'num', index: i }],
      note: `candidate = ${res}, count = ${count}`,
    }),
  ];

  r.step({
    at: 'int res = 0, count = 0;',
    explain:
      'Boyer-Moore voting: hold one candidate and a counter. Matching values vote for it, different ones vote against — the true majority survives every cancellation.',
    visuals: [arr(nums, { title: 'nums' })],
  });

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    if (count === 0) {
      res = num;
      r.step({
        at: ['if (count == 0) {', 'res = num;'],
        explain: `The counter hit 0, so every earlier vote cancelled out — adopt ${num} as the new candidate.`,
        vars: { num, res, count },
        visuals: view(i, 'active'),
        tone: 'warn',
      });
    }
    count += num === res ? 1 : -1;
    r.step({
      at: 'count += (num == res) ? 1 : -1;',
      explain: num === res ? `${num} matches the candidate — count rises to ${count}.` : `${num} differs from the candidate ${res} — the two cancel, count falls to ${count}.`,
      vars: { num, res, count },
      visuals: view(i, num === res ? 'success' : 'error'),
    });
  }

  r.step({
    at: 'return res;',
    explain: `A value appearing more than n/2 times cannot be cancelled away, so the surviving candidate ${res} is the majority element.`,
    vars: { res, count },
    visuals: [arr(nums, { title: 'nums', states: nums.map((v) => (v === res ? ('success' as CellState) : ('muted' as CellState))) })],
    tone: 'success',
    result: `return ${res}`,
  });
}

/* ── Range Sum Query - Immutable ──────────────────────────────────────────── */

function rangeSumQuery(r: Recorder, nums: number[], queries: [number, number][]) {
  const prefix = new Array(nums.length + 1).fill(0);

  const view = (activePrefix: number[], activeNums: number[]): Visual[] => [
    arr(nums, { title: 'nums', states: nums.map((_, i) => (activeNums.includes(i) ? ('active' as CellState) : undefined)) }),
    arr(prefix, {
      title: 'prefix  (prefix[i] = sum of the first i values)',
      states: prefix.map((_, i) => (activePrefix.includes(i) ? ('success' as CellState) : undefined)),
    }),
  ];

  r.step({
    at: 'prefix = new int[nums.length + 1];',
    explain: 'The extra leading 0 removes the "does the range start at 0?" special case from sumRange.',
    visuals: view([0], []),
  });

  for (let i = 0; i < nums.length; i++) {
    prefix[i + 1] = prefix[i] + nums[i];
    r.step({
      at: 'prefix[i + 1] = prefix[i] + nums[i];',
      explain: `prefix[${i + 1}] = prefix[${i}] + nums[${i}] = ${prefix[i]} + ${nums[i]} = ${prefix[i + 1]}.`,
      vars: { i, 'prefix[i + 1]': prefix[i + 1] },
      visuals: view([i, i + 1], [i]),
    });
  }

  for (const [left, right] of queries) {
    const sum = prefix[right + 1] - prefix[left];
    r.step({
      at: 'return prefix[right + 1] - prefix[left];',
      explain: `sumRange(${left}, ${right}) = prefix[${right + 1}] − prefix[${left}] = ${prefix[right + 1]} − ${prefix[left]} = ${sum}. One subtraction, no loop.`,
      vars: { left, right, sum },
      visuals: [
        arr(nums, { title: 'nums', states: nums.map((_, i) => (i >= left && i <= right ? ('window' as CellState) : ('muted' as CellState))) }),
        arr(prefix, { title: 'prefix', states: prefix.map((_, i) => (i === left || i === right + 1 ? ('success' as CellState) : undefined)) }),
      ],
      tone: 'success',
      result: `sumRange(${left}, ${right}) = ${sum}`,
    });
  }
}

/* ── H-Index ──────────────────────────────────────────────────────────────── */

function hIndex(r: Recorder, input: number[]) {
  const citations = input.slice().sort((a, b) => a - b);
  const n = citations.length;

  r.step({
    at: 'Arrays.sort(citations);',
    explain: `Sorting ascending (${list(input)} → ${list(citations)}) means that from index i onwards there are exactly n − i papers, each with at least citations[i] citations.`,
    visuals: [arr(citations, { title: 'citations (sorted)' })],
  });

  for (let i = 0; i < n; i++) {
    const hCandidate = n - i;
    const ok = citations[i] >= hCandidate;
    r.step({
      at: ['int hCandidate = n - i; // Number of papers with at least citations[i] citations', 'if (citations[i] >= hCandidate) {'],
      explain: ok
        ? `From index ${i} on there are ${hCandidate} papers, and citations[${i}] = ${citations[i]} ≥ ${hCandidate} — so ${hCandidate} papers have at least ${hCandidate} citations each.`
        : `From index ${i} on there are ${hCandidate} papers, but citations[${i}] = ${citations[i]} < ${hCandidate} — not enough.`,
      vars: { i, 'citations[i]': citations[i], hCandidate },
      visuals: [
        arr(citations, {
          title: 'citations (sorted)',
          states: citations.map((_, k) => (k === i ? (ok ? 'success' : 'error') : k > i ? ('window' as CellState) : ('muted' as CellState))),
          pointers: [{ name: 'i', index: i }],
        }),
      ],
      tone: ok ? 'success' : 'neutral',
    });
    if (ok) {
      r.step({
        at: 'return hCandidate;',
        explain: `The h-index is ${hCandidate}.`,
        visuals: [
          arr(citations, { title: 'citations (sorted)', states: citations.map((_, k) => (k >= i ? ('success' as CellState) : ('muted' as CellState))) }),
        ],
        tone: 'success',
        result: `return ${hCandidate}`,
      });
      return;
    }
  }

  r.step({
    at: 'return 0;',
    explain: 'No paper has enough citations.',
    visuals: [arr(citations, { title: 'citations (sorted)' })],
    tone: 'warn',
    result: 'return 0',
  });
}

/* ── Sort Colors ──────────────────────────────────────────────────────────── */

function sortColors(r: Recorder, input: number[]) {
  const nums = input.slice();
  const frequencies = [0, 0, 0];

  const freqViz = (active?: number): Visual =>
    arr(frequencies, {
      title: 'frequencies',
      labels: ['0s', '1s', '2s'],
      indexed: false,
      states: frequencies.map((_, i) => (i === active ? ('active' as CellState) : undefined)),
    });

  r.step({
    at: 'int[] frequencies = new int[3];',
    explain: 'Only three possible values, so counting them is enough — a counting sort in two passes, no comparisons.',
    visuals: [arr(nums, { title: 'nums' }), freqViz()],
  });

  for (let i = 0; i < nums.length; i++) {
    frequencies[nums[i]]++;
    r.step({
      at: 'for (int num : nums) frequencies[num]++;',
      explain: `nums[${i}] = ${nums[i]} → there are now ${frequencies[nums[i]]} of them.`,
      vars: { num: nums[i] },
      visuals: [
        arr(nums, { title: 'nums', states: nums.map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
        freqViz(nums[i]),
      ],
    });
  }

  for (let i = 0; i < nums.length; i++) {
    const value = frequencies[0] > 0 ? 0 : frequencies[1] > 0 ? 1 : 2;
    frequencies[value]--;
    nums[i] = value;
    r.step({
      at: value === 0 ? ['if (frequencies[0] > 0) {', 'nums[i] = 0;'] : value === 1 ? ['} else if (frequencies[1] > 0) {', 'nums[i] = 1;'] : ['} else {', 'nums[i] = 2;'],
      explain: `Write the smallest colour still available: nums[${i}] = ${value}.`,
      vars: { i, value },
      visuals: [
        arr(nums, { title: 'nums', states: nums.map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('success' as CellState) : ('muted' as CellState))) }),
        freqViz(value),
      ],
    });
  }

  r.step({
    at: 'public void sortColors(int[] nums) {',
    explain: 'Sorted in O(n) time and O(1) extra space.',
    visuals: [arr(nums, { title: 'nums', states: nums.map(() => 'success' as CellState) })],
    tone: 'success',
    result: `nums = ${list(nums)}`,
  });
}

/* ── Find the Duplicate Number ────────────────────────────────────────────── */

function findDuplicate(r: Recorder, input: number[]) {
  const nums = input.slice();

  const view = (i: number, index: number, state: CellState): Visual[] => [
    arr(nums, {
      title: 'nums  (a negative value marks "index already visited")',
      states: nums.map((v, k) => (k === index ? state : k === i ? ('active' as CellState) : v < 0 ? ('visited' as CellState) : undefined)),
      pointers: [
        { name: 'num', index: i },
        { name: 'index', index, tone: 2 },
      ],
    }),
  ];

  r.step({
    at: 'public int findDuplicate(int[] nums) {',
    explain:
      'The values are in 1…n, so each value can point at an index. Flipping the sign of that slot records "this value was seen" without any extra memory.',
    visuals: [arr(nums, { title: 'nums' })],
  });

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const index = Math.abs(num) - 1;
    if (nums[index] < 0) {
      r.step({
        at: ['if (nums[index] < 0) {', 'return Math.abs(num);'],
        explain: `Value ${Math.abs(num)} points at index ${index}, which is already negative — so ${Math.abs(num)} has been seen before.`,
        vars: { num: Math.abs(num), index },
        visuals: view(i, index, 'error'),
        tone: 'success',
        result: `return ${Math.abs(num)}`,
      });
      return;
    }
    nums[index] *= -1;
    r.step({
      at: 'nums[index] *= -1;',
      explain: `Value ${Math.abs(num)} is new: negate nums[${index}] to record it.`,
      vars: { num: Math.abs(num), index, 'nums[index]': nums[index] },
      visuals: view(i, index, 'window'),
    });
  }

  r.step({
    at: 'return -1;',
    explain: 'No value repeated.',
    visuals: [arr(nums, { title: 'nums' })],
    tone: 'error',
    result: 'return -1',
  });
}

/* ── Product of Array Except Self ─────────────────────────────────────────── */

function productExceptSelf(r: Recorder, nums: number[]) {
  const res = new Array(nums.length).fill(0);
  let prefix = 1;

  r.step({
    at: ['int[] res = new int[nums.length];', 'int prefix = 1;'],
    explain:
      'Everything except nums[i] is "everything to its left" × "everything to its right". Two sweeps compute both without division and without extra arrays.',
    visuals: [arr(nums, { title: 'nums' }), arr(res, { title: 'res' })],
  });

  for (let i = 0; i < nums.length; i++) {
    res[i] = prefix;
    const before = prefix;
    prefix *= nums[i];
    r.step({
      at: ['res[i] = prefix;', 'prefix *= nums[i];'],
      explain: `res[${i}] = ${before}, the product of everything to the left of index ${i}. Then prefix becomes ${before} × ${nums[i]} = ${prefix}.`,
      vars: { i, prefix },
      visuals: [
        arr(nums, { title: 'nums', states: nums.map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
        arr(res, { title: 'res  (left products)', states: res.map((_, k) => (k === i ? ('success' as CellState) : k < i ? ('window' as CellState) : undefined)) }),
      ],
    });
  }

  let postfix = 1;
  r.step({
    at: 'int postfix = 1;',
    explain: 'Now sweep backwards, multiplying in the product of everything to the right.',
    visuals: [arr(nums, { title: 'nums' }), arr(res, { title: 'res  (left products)' })],
  });

  for (let i = nums.length - 1; i >= 0; i--) {
    const before = res[i];
    res[i] *= postfix;
    const beforePostfix = postfix;
    postfix *= nums[i];
    r.step({
      at: ['res[i] *= postfix;', 'postfix *= nums[i];'],
      explain: `res[${i}] = ${before} × ${beforePostfix} = ${res[i]}. Then postfix becomes ${beforePostfix} × ${nums[i]} = ${postfix}.`,
      vars: { i, postfix },
      visuals: [
        arr(nums, { title: 'nums', states: nums.map((_, k) => (k === i ? ('active' as CellState) : k > i ? ('visited' as CellState) : undefined)) }),
        arr(res, { title: 'res', states: res.map((_, k) => (k === i ? ('success' as CellState) : k > i ? ('window' as CellState) : undefined)) }),
      ],
    });
  }

  r.step({
    at: 'return res;',
    explain: 'Two linear passes, no division, O(1) extra space beyond the output.',
    visuals: [arr(nums, { title: 'nums' }), arr(res, { title: 'res', states: res.map(() => 'success' as CellState) })],
    tone: 'success',
    result: `return ${list(res)}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const miscTracers: Record<string, Tracer> = {
  'easy/greedy/BestTimeToBuyAndSellStocks': {
    examples: [
      { label: 'prices = [10,1,5,6,7,1]', input: 'prices = [10, 1, 5, 6, 7, 1]', run: (r) => maxProfit(r, [10, 1, 5, 6, 7, 1]) },
      { label: 'falling prices', input: 'prices = [7, 6, 4, 3, 1]', run: (r) => maxProfit(r, [7, 6, 4, 3, 1]) },
    ],
  },
  'easy/math/HappyNumber': {
    examples: [
      { label: 'n = 19 (happy)', input: 'n = 19', run: (r) => isHappy(r, 19) },
      { label: 'n = 2 (not happy)', input: 'n = 2', run: (r) => isHappy(r, 2) },
    ],
  },
  'easy/various/LongestCommonPrefix': {
    examples: [
      { label: '["flower","flow","flight"]', input: 'strs = ["flower", "flow", "flight"]', run: (r) => longestCommonPrefix(r, ['flower', 'flow', 'flight']) },
      { label: 'no common prefix', input: 'strs = ["dog", "racecar", "car"]', run: (r) => longestCommonPrefix(r, ['dog', 'racecar', 'car']) },
      { label: 'first string is the prefix', input: 'strs = ["ab", "abc"]', run: (r) => longestCommonPrefix(r, ['ab', 'abc']) },
    ],
  },
  'easy/various/MajorityElement': {
    examples: [
      { label: 'nums = [2,2,1,1,1,2,2]', input: 'nums = [2, 2, 1, 1, 1, 2, 2]', run: (r) => majorityElement(r, [2, 2, 1, 1, 1, 2, 2]) },
      { label: 'nums = [3,3,4]', input: 'nums = [3, 3, 4]', run: (r) => majorityElement(r, [3, 3, 4]) },
    ],
  },
  'easy/various/RangeSumQueryImmutable': {
    examples: [
      {
        label: 'nums = [-2,0,3,-5,2,-1]',
        input: 'nums = [-2, 0, 3, -5, 2, -1], then sumRange(0,2), sumRange(2,5), sumRange(0,5)',
        run: (r) => rangeSumQuery(r, [-2, 0, 3, -5, 2, -1], [[0, 2], [2, 5], [0, 5]]),
      },
    ],
  },
  'medium/sorting/HIndex': {
    examples: [
      { label: 'citations = [3,0,6,1,5]', input: 'citations = [3, 0, 6, 1, 5]', run: (r) => hIndex(r, [3, 0, 6, 1, 5]) },
      { label: 'citations = [1,1]', input: 'citations = [1, 1]', run: (r) => hIndex(r, [1, 1]) },
    ],
  },
  'medium/sorting/SortColors': {
    examples: [
      { label: 'nums = [2,0,2,1,1,0]', input: 'nums = [2, 0, 2, 1, 1, 0]', run: (r) => sortColors(r, [2, 0, 2, 1, 1, 0]) },
      { label: 'nums = [2,0,1]', input: 'nums = [2, 0, 1]', run: (r) => sortColors(r, [2, 0, 1]) },
    ],
  },
  'medium/various/FindTheDuplicateNumber': {
    examples: [
      { label: 'nums = [1,3,4,2,2]', input: 'nums = [1, 3, 4, 2, 2]', run: (r) => findDuplicate(r, [1, 3, 4, 2, 2]) },
      { label: 'nums = [3,1,3,4,2]', input: 'nums = [3, 1, 3, 4, 2]', run: (r) => findDuplicate(r, [3, 1, 3, 4, 2]) },
    ],
  },
  'medium/various/ProductsOfArraysExceptSelf': {
    examples: [
      { label: 'nums = [1,2,4,6]', input: 'nums = [1, 2, 4, 6]', run: (r) => productExceptSelf(r, [1, 2, 4, 6]) },
      { label: 'with a zero', input: 'nums = [-1, 0, 1, 2, 3]', run: (r) => productExceptSelf(r, [-1, 0, 1, 2, 3]) },
    ],
  },
};
