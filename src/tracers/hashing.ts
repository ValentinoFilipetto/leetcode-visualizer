import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, at, chars, grid, list, mapOf, setOf, setStr } from './helpers';

/* ── Two Sum ──────────────────────────────────────────────────────────────── */

function twoSum(r: Recorder, nums: number[], target: number) {
  const seen = new Map<number, number>();
  const view = (active: number, state: CellState, mapState?: { key: number; state: CellState }): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: at(nums.length, [active], state),
      pointers: active >= 0 ? [{ name: 'i', index: active }] : [],
    }),
    {
      ...mapOf('complementToIndex  (value → index)', seen),
      entries: [...seen].map(([key, value]) => ({
        key,
        value,
        state: mapState && mapState.key === key ? mapState.state : undefined,
      })),
    },
  ];

  r.step({
    at: 'Map<Integer, Integer> complementToIndex',
    explain: 'Walk the array once, remembering every value we have already seen together with its index.',
    vars: { target },
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const complement = target - num;
    r.step({
      at: ['int num = nums[i];', 'int complement = target - num;'],
      explain: `nums[${i}] = ${num}. To reach ${target} we still need ${target} − ${num} = ${complement}.`,
      vars: { i, num, complement },
      visuals: view(i, 'active'),
    });

    if (seen.has(complement)) {
      const index = seen.get(complement)!;
      r.step({
        at: ['if (complementToIndex.containsKey(complement))', 'return new int[] { index, i };'],
        explain: `${complement} is already in the map at index ${index} — that pair sums to ${target}.`,
        vars: { i, complement, index },
        visuals: [
          arr(nums, {
            title: 'nums',
            states: at(nums.length, [index, i], 'success'),
            pointers: [
              { name: 'index', index, tone: 3 },
              { name: 'i', index: i },
            ],
          }),
          {
            ...mapOf('complementToIndex  (value → index)', seen),
            entries: [...seen].map(([key, value]) => ({
              key,
              value,
              state: key === complement ? ('success' as CellState) : undefined,
            })),
          },
        ],
        tone: 'success',
        result: `return [${index}, ${i}]`,
      });
      return;
    }

    seen.set(num, i);
    r.step({
      at: 'complementToIndex.put(num, i);',
      explain: `No ${complement} yet, so store ${num} → ${i} in case a later element needs it.`,
      vars: { i, num },
      visuals: view(i, 'visited', { key: num, state: 'active' }),
    });
  }

  r.step({
    at: 'return new int[] {};',
    explain: 'The array ran out without a matching pair.',
    visuals: view(-1, 'idle'),
    tone: 'error',
    result: 'return []',
  });
}

/* ── Contains Duplicate ───────────────────────────────────────────────────── */

function containsDuplicate(r: Recorder, nums: number[]) {
  const seen = new Set<number>();
  const view = (i: number, state: CellState, hit?: number): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: at(nums.length, [i], state),
      pointers: i >= 0 ? [{ name: 'num', index: i }] : [],
    }),
    {
      ...setOf('seen', seen),
      entries: [...seen].map((key) => ({
        key,
        state: hit === key ? ('error' as CellState) : undefined,
      })),
    },
  ];

  r.step({
    at: 'Set<Integer> seen = new HashSet<>();',
    explain: 'A hash set gives O(1) membership checks, so one pass is enough.',
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    r.step({
      at: 'if (seen.contains(num)) return true;',
      explain: `Have we seen ${num} before?`,
      vars: { num, seen: setStr(seen) },
      visuals: view(i, 'active'),
    });
    if (seen.has(num)) {
      r.step({
        at: 'if (seen.contains(num)) return true;',
        explain: `Yes — ${num} appeared earlier, so the array contains a duplicate.`,
        vars: { num },
        visuals: view(i, 'error', num),
        tone: 'success',
        result: 'return true',
      });
      return;
    }
    seen.add(num);
    r.step({
      at: 'seen.add(num);',
      explain: `${num} is new; remember it and move on.`,
      vars: { num, seen: setStr(seen) },
      visuals: view(i, 'visited', undefined),
    });
  }

  r.step({
    at: 'return false;',
    explain: 'Every value was distinct.',
    visuals: view(-1, 'idle'),
    tone: 'success',
    result: 'return false',
  });
}

/* ── Valid Anagram ────────────────────────────────────────────────────────── */

function isAnagram(r: Recorder, s: string, t: string) {
  const counts = new Array(26).fill(0);
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const countView = (active: number[] = [], state: CellState = 'active'): Visual =>
    arr(counts, {
      title: 'occurrences[26]',
      labels: letters,
      indexed: false,
      states: counts.map((c, i) =>
        active.includes(i) ? state : c !== 0 ? ('compare' as CellState) : undefined,
      ),
    });

  r.step({
    at: 'if (s.length() != t.length()) return false;',
    explain: `Different lengths can never be anagrams — here both are ${s.length} and ${t.length}.`,
    vars: { 's.length()': s.length, 't.length()': t.length },
    visuals: [arr(chars(s), { title: 's' }), arr(chars(t), { title: 't' })],
  });

  if (s.length !== t.length) {
    r.step({
      at: 'if (s.length() != t.length()) return false;',
      explain: 'The lengths differ, so we can answer immediately.',
      visuals: [arr(chars(s), { title: 's' }), arr(chars(t), { title: 't' })],
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  r.step({
    at: 'int[] occurrences = new int[26];',
    explain: 'One counter per letter: s increments it, t decrements it.',
    visuals: [arr(chars(s), { title: 's' }), arr(chars(t), { title: 't' }), countView()],
  });

  for (let i = 0; i < s.length; i++) {
    const si = s.charCodeAt(i) - 97;
    const ti = t.charCodeAt(i) - 97;
    counts[si]++;
    counts[ti]--;
    r.step({
      at: ["occurrences[s.charAt(i) - 'a']++;", "occurrences[t.charAt(i) - 'a']--;"],
      explain: `i = ${i}: '${s[i]}' from s adds 1, '${t[i]}' from t subtracts 1.`,
      vars: { i, [`s[${i}]`]: s[i], [`t[${i}]`]: t[i] },
      visuals: [
        arr(chars(s), { title: 's', states: at(s.length, [i], 'active'), pointers: [{ name: 'i', index: i }] }),
        arr(chars(t), { title: 't', states: at(t.length, [i], 'compare'), pointers: [{ name: 'i', index: i, tone: 2 }] }),
        countView([si, ti]),
      ],
    });
  }

  for (let i = 0; i < 26; i++) {
    if (counts[i] === 0) continue;
    r.step({
      at: ['for (int val : occurrences)', 'if (val != 0) return false;'],
      explain: `'${letters[i]}' has a leftover count of ${counts[i]}, so the two strings are not anagrams.`,
      vars: { letter: letters[i], val: counts[i] },
      visuals: [arr(chars(s), { title: 's' }), arr(chars(t), { title: 't' }), countView([i], 'error')],
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  r.step({
    at: 'return true;',
    explain: 'Every counter cancelled out to 0 — same letters, same multiplicities.',
    visuals: [arr(chars(s), { title: 's' }), arr(chars(t), { title: 't' }), countView()],
    tone: 'success',
    result: 'return true',
  });
}

/* ── Longest Palindrome ───────────────────────────────────────────────────── */

function longestPalindrome(r: Recorder, s: string) {
  const freq = new Map<string, number>();
  r.step({
    at: 'Map<Character, Integer> frequencyMap = new HashMap<>();',
    explain: 'First count how often each character appears.',
    visuals: [arr(chars(s), { title: 's' }), mapOf('frequencyMap', freq)],
  });

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    freq.set(c, (freq.get(c) ?? 0) + 1);
    r.step({
      at: 'frequencyMap.put(c, frequencyMap.getOrDefault(c, 0) + 1);',
      explain: `'${c}' now appears ${freq.get(c)}×.`,
      vars: { c, count: freq.get(c) },
      visuals: [
        arr(chars(s), { title: 's', states: at(s.length, [i], 'active'), pointers: [{ name: 'c', index: i }] }),
        {
          ...mapOf('frequencyMap', freq),
          entries: [...freq].map(([key, value]) => ({ key, value, state: key === c ? ('active' as CellState) : undefined })),
        },
      ],
    });
  }

  let maxLength = 0;
  let hasOdd = false;
  for (const [c, f] of freq) {
    if (f % 2 === 0) {
      maxLength += f;
      r.step({
        at: 'if (frequency % 2 == 0) maxLength += frequency;',
        explain: `'${c}' appears ${f}× (even) — all ${f} can be mirrored around the centre.`,
        vars: { frequency: f, maxLength, hasOddValues: hasOdd },
        visuals: [
          {
            ...mapOf('frequencyMap', freq),
            entries: [...freq].map(([key, value]) => ({
              key,
              value,
              state: key === c ? ('success' as CellState) : undefined,
            })),
          },
        ],
      });
    } else {
      maxLength += f - 1;
      hasOdd = true;
      r.step({
        at: ['maxLength += frequency - 1;', 'hasOddValues = true;'],
        explain: `'${c}' appears ${f}× (odd) — use ${f - 1} of them in pairs and note that a spare character exists.`,
        vars: { frequency: f, maxLength, hasOddValues: hasOdd },
        visuals: [
          {
            ...mapOf('frequencyMap', freq),
            entries: [...freq].map(([key, value]) => ({
              key,
              value,
              state: key === c ? ('compare' as CellState) : undefined,
            })),
          },
        ],
      });
    }
  }

  r.step({
    at: 'return hasOddValues ? maxLength + 1 : maxLength;',
    explain: hasOdd
      ? `One leftover character can sit in the middle, so the answer is ${maxLength} + 1.`
      : 'No odd counts, so nothing extra goes in the middle.',
    vars: { maxLength, hasOddValues: hasOdd },
    visuals: [mapOf('frequencyMap', freq)],
    tone: 'success',
    result: `return ${hasOdd ? maxLength + 1 : maxLength}`,
  });
}

/* ── Group Anagrams ───────────────────────────────────────────────────────── */

function groupAnagrams(r: Recorder, strs: string[]) {
  const groups = new Map<string, string[]>();
  const groupsViz = (activeKey?: string): Visual => ({
    kind: 'text',
    title: 'patternToStringsMap',
    chips: true,
    emptyHint: '{}',
    lines: [...groups].map(([k, v]) => ({
      text: `${k} → [${v.join(', ')}]`,
      state: k === activeKey ? ('active' as CellState) : undefined,
    })),
  });

  r.step({
    at: 'Map<String, List<String>> patternToStringsMap = new HashMap<>();',
    explain: 'Anagrams share the same letter-count signature, so that signature can be the map key.',
    visuals: [arr(strs, { title: 'strs' }), groupsViz()],
  });

  for (let i = 0; i < strs.length; i++) {
    const s = strs[i];
    const pattern = new Array(26).fill(0);
    for (const c of s) pattern[c.charCodeAt(0) - 97]++;
    const shortKey = [...s].sort().join('') || '""';

    r.step({
      at: ['int[] pattern = new int[26];', "for (char c : s.toCharArray()) pattern[c - 'a']++;"],
      explain: `"${s}" contains ${[...new Set(s)]
        .map((c) => `${c}×${[...s].filter((x) => x === c).length}`)
        .join(', ')}.`,
      vars: { s, signature: shortKey },
      visuals: [
        arr(strs, { title: 'strs', states: at(strs.length, [i], 'active'), pointers: [{ name: 's', index: i }] }),
        arr(pattern, {
          title: 'pattern[26]',
          indexed: false,
          labels: Array.from({ length: 26 }, (_, k) => String.fromCharCode(97 + k)),
          states: pattern.map((v: number) => (v > 0 ? ('compare' as CellState) : undefined)),
        }),
        groupsViz(),
      ],
    });

    const existing = groups.get(shortKey);
    groups.set(shortKey, [...(existing ?? []), s]);
    r.step({
      at: ['.computeIfAbsent(patternAsString, k -> new ArrayList<>())', '.add(s);'],
      explain: existing
        ? `That signature already has a bucket — "${s}" joins [${existing.join(', ')}].`
        : `First word with this signature, so a new bucket is created for "${s}".`,
      vars: { key: shortKey, bucket: `[${groups.get(shortKey)!.join(', ')}]` },
      visuals: [
        arr(strs, { title: 'strs', states: at(strs.length, [i], 'visited') }),
        groupsViz(shortKey),
      ],
    });
  }

  r.step({
    at: 'return new ArrayList<>(patternToStringsMap.values());',
    explain: 'The map values are exactly the groups of anagrams.',
    visuals: [groupsViz()],
    tone: 'success',
    result: `return [${[...groups.values()].map((g) => `[${g.join(', ')}]`).join(', ')}]`,
  });
}

/* ── Longest Consecutive Sequence ─────────────────────────────────────────── */

function longestConsecutive(r: Recorder, nums: number[]) {
  const set = new Set(nums);
  r.step({
    at: ['Set<Integer> set = new HashSet<>();', 'for (int num : nums) set.add(num);'],
    explain: 'Dump every number into a set so "does x exist?" is O(1).',
    visuals: [arr(nums, { title: 'nums' }), setOf('set', [...set].sort((a, b) => a - b))],
  });

  let maxLength = 0;
  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const sorted = [...set].sort((a, b) => a - b);
    if (set.has(num - 1)) {
      r.step({
        at: 'if (set.contains(num - 1)) continue;',
        explain: `${num} has ${num - 1} to its left, so it is not the start of a run — skip it.`,
        vars: { num, maxLength },
        visuals: [
          arr(nums, { title: 'nums', states: at(nums.length, [i], 'muted'), pointers: [{ name: 'num', index: i }] }),
          {
            ...setOf('set', sorted),
            entries: sorted.map((key) => ({
              key,
              state: key === num ? ('muted' as CellState) : key === num - 1 ? ('compare' as CellState) : undefined,
            })),
          },
        ],
      });
      continue;
    }

    let length = 1;
    let curNum = num + 1;
    r.step({
      at: 'int length = 1, curNum = num + 1;',
      explain: `${num - 1} is missing, so ${num} starts a run. Count upwards from here.`,
      vars: { num, length, curNum },
      visuals: [
        arr(nums, { title: 'nums', states: at(nums.length, [i], 'active'), pointers: [{ name: 'num', index: i }] }),
        {
          ...setOf('set', sorted),
          entries: sorted.map((key) => ({ key, state: key === num ? ('active' as CellState) : undefined })),
        },
      ],
    });

    while (set.has(curNum)) {
      const runStart = num;
      curNum++;
      length++;
      r.step({
        at: ['while (set.contains(curNum))', 'length++;'],
        explain: `${curNum - 1} is in the set, so the run ${runStart}…${curNum - 1} is now ${length} long.`,
        vars: { num, curNum, length },
        visuals: [
          arr(nums, { title: 'nums', states: at(nums.length, [i], 'active') }),
          {
            ...setOf('set', sorted),
            entries: sorted.map((key) => ({
              key,
              state: key >= runStart && key < curNum ? ('window' as CellState) : undefined,
            })),
          },
        ],
      });
    }

    maxLength = Math.max(maxLength, length);
    r.step({
      at: 'maxLength = Math.max(maxLength, length);',
      explain: `The run starting at ${num} has length ${length}; the best so far is ${maxLength}.`,
      vars: { num, length, maxLength },
      visuals: [
        arr(nums, { title: 'nums', states: at(nums.length, [i], 'done') }),
        {
          ...setOf('set', sorted),
          entries: sorted.map((key) => ({
            key,
            state: key >= num && key < num + length ? ('success' as CellState) : undefined,
          })),
        },
      ],
    });
  }

  r.step({
    at: 'return maxLength;',
    explain: `Longest consecutive run found: ${maxLength}.`,
    vars: { maxLength },
    visuals: [arr(nums, { title: 'nums' })],
    tone: 'success',
    result: `return ${maxLength}`,
  });
}

/* ── Top K Frequent Elements ──────────────────────────────────────────────── */

function topKFrequent(r: Recorder, nums: number[], k: number) {
  const count = new Map<number, number>();
  const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
  const bucketViz = (active?: number): Visual =>
    arr(
      buckets.map((b) => (b.length ? b.join(' ') : '·')),
      {
        title: 'frequencies  (index = how often)',
        labels: buckets.map((_, i) => `${i}×`),
        indexed: false,
        states: buckets.map((b, i) =>
          i === active ? ('active' as CellState) : b.length ? ('compare' as CellState) : undefined,
        ),
      },
    );

  r.step({
    at: ['Map<Integer, Integer> count = new HashMap<>();', 'List<Integer>[] frequencies = new ArrayList[nums.length + 1];'],
    explain:
      'Bucket sort: a value can appear at most n times, so an array of n+1 buckets indexed by frequency is enough — no sorting needed.',
    vars: { k },
    visuals: [arr(nums, { title: 'nums' }), mapOf('count', count), bucketViz()],
  });

  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    count.set(n, (count.get(n) ?? 0) + 1);
    r.step({
      at: 'for (int n : nums) count.put(n, count.getOrDefault(n, 0) + 1);',
      explain: `${n} has now been seen ${count.get(n)}×.`,
      vars: { n, count: count.get(n) },
      visuals: [
        arr(nums, { title: 'nums', states: at(nums.length, [i], 'active'), pointers: [{ name: 'n', index: i }] }),
        {
          ...mapOf('count', count),
          entries: [...count].map(([key, value]) => ({ key, value, state: key === n ? ('active' as CellState) : undefined })),
        },
        bucketViz(),
      ],
    });
  }

  for (const [value, freq] of count) {
    buckets[freq].push(value);
    r.step({
      at: 'frequencies[entry.getValue()].add(entry.getKey());',
      explain: `${value} appears ${freq}× → drop it into bucket ${freq}.`,
      vars: { key: value, value: freq },
      visuals: [
        {
          ...mapOf('count', count),
          entries: [...count].map(([key, v]) => ({ key, value: v, state: key === value ? ('active' as CellState) : undefined })),
        },
        bucketViz(freq),
      ],
    });
  }

  const res: number[] = [];
  for (let i = buckets.length - 1; i > 0; i--) {
    if (buckets[i].length === 0) {
      r.step({
        at: 'for (int i = frequencies.length - 1; i > 0; i--)',
        explain: `Bucket ${i} is empty — keep scanning downwards.`,
        vars: { i, res: list(res) },
        visuals: [bucketViz(i), arr(res, { title: 'res' })],
      });
      continue;
    }
    for (const n of buckets[i]) {
      res.push(n);
      if (res.length === k) {
        r.step({
          at: ['res[index++] = n;', 'if (index == k) return res;'],
          explain: `${n} occurs ${i}× — that fills the k = ${k} slots, so we are done.`,
          vars: { i, n, res: list(res) },
          visuals: [bucketViz(i), arr(res, { title: 'res', states: res.map(() => 'success' as CellState) })],
          tone: 'success',
          result: `return ${list(res)}`,
        });
        return;
      }
      r.step({
        at: 'res[index++] = n;',
        explain: `${n} occurs ${i}×, the highest remaining frequency — take it.`,
        vars: { i, n, res: list(res) },
        visuals: [bucketViz(i), arr(res, { title: 'res', states: res.map(() => 'success' as CellState) })],
      });
    }
  }

  r.step({
    at: 'return res;',
    explain: 'All buckets scanned.',
    visuals: [arr(res, { title: 'res' })],
    tone: 'success',
    result: `return ${list(res)}`,
  });
}

/* ── Valid Sudoku ─────────────────────────────────────────────────────────── */

function validSudoku(r: Recorder, board: string[][]) {
  const rows = new Map<number, Set<string>>();
  const cols = new Map<number, Set<string>>();
  const squares = new Map<string, Set<string>>();

  const boardViz = (rr: number, cc: number, state: CellState): Visual =>
    grid(board, {
      title: 'board',
      compact: true,
      cursor: [rr, cc],
      states: board.map((row, i) =>
        row.map((_, j) =>
          i === rr && j === cc
            ? state
            : Math.floor(i / 3) === Math.floor(rr / 3) && Math.floor(j / 3) === Math.floor(cc / 3)
              ? ('window' as CellState)
              : i === rr || j === cc
                ? ('visited' as CellState)
                : undefined,
        ),
      ),
    });

  const setsViz = (rr: number, cc: number, digit?: string): Visual[] => {
    const key = `${Math.floor(rr / 3)},${Math.floor(cc / 3)}`;
    const paint = (values: Iterable<string>, title: string): Visual => ({
      ...setOf(title, [...values].sort()),
      entries: [...values].sort().map((k) => ({ key: k, state: k === digit ? ('error' as CellState) : undefined })),
    });
    return [
      paint(rows.get(rr) ?? [], `rows[${rr}]`),
      paint(cols.get(cc) ?? [], `cols[${cc}]`),
      paint(squares.get(key) ?? [], `squares["${key}"]`),
    ];
  };

  r.step({
    at: ['Map<Integer, Set<Character>> rows = new HashMap<>();', 'Map<String, Set<Character>> squares = new HashMap<>();'],
    explain:
      'Three lookup tables: the digits already used in each row, in each column, and in each 3×3 square (keyed by "row/3,col/3").',
    visuals: [grid(board, { title: 'board', compact: true })],
  });

  for (let rr = 0; rr < 9; rr++) {
    for (let cc = 0; cc < 9; cc++) {
      const digit = board[rr][cc];
      if (digit === '.') continue;
      const key = `${Math.floor(rr / 3)},${Math.floor(cc / 3)}`;
      const inRow = rows.get(rr)?.has(digit);
      const inCol = cols.get(cc)?.has(digit);
      const inSquare = squares.get(key)?.has(digit);

      if (inRow || inCol || inSquare) {
        const where = inRow ? `row ${rr}` : inCol ? `column ${cc}` : `square ${key}`;
        r.step({
          at: ['if (rows.computeIfAbsent(r, k -> new HashSet<>()).contains(board[r][c]) ||', 'return false;'],
          explain: `'${digit}' at (${rr}, ${cc}) already exists in ${where} — the board is invalid.`,
          vars: { r: rr, c: cc, digit, squareKey: key },
          visuals: [boardViz(rr, cc, 'error'), ...setsViz(rr, cc, digit)],
          tone: 'error',
          result: 'return false',
        });
        return;
      }

      if (!rows.has(rr)) rows.set(rr, new Set());
      if (!cols.has(cc)) cols.set(cc, new Set());
      if (!squares.has(key)) squares.set(key, new Set());
      rows.get(rr)!.add(digit);
      cols.get(cc)!.add(digit);
      squares.get(key)!.add(digit);

      r.step({
        at: ['rows.get(r).add(board[r][c]);', 'squares.get(squareKey).add(board[r][c]);'],
        explain: `'${digit}' at (${rr}, ${cc}) is new for its row, column and square — record it in all three.`,
        vars: { r: rr, c: cc, digit, squareKey: key },
        visuals: [boardViz(rr, cc, 'active'), ...setsViz(rr, cc)],
      });
    }
  }

  r.step({
    at: 'return true;',
    explain: 'Every filled cell was unique in its row, column and 3×3 square.',
    visuals: [grid(board, { title: 'board', compact: true })],
    tone: 'success',
    result: 'return true',
  });
}

/* ── Encode and Decode Strings ────────────────────────────────────────────── */

function encodeDecode(r: Recorder, strs: string[]) {
  let encoded = '';
  r.step({
    at: 'StringBuilder res = new StringBuilder();',
    explain: 'Encoding prefixes every string with its length and a "#" delimiter, so any character can appear safely in the payload.',
    visuals: [{ ...{ kind: 'text' as const, title: 'strs', chips: true, lines: strs.map((s) => ({ text: `"${s}"` })) } }],
  });

  for (const s of strs) {
    encoded += `${s.length}#${s}`;
    r.step({
      at: "res.append(s.length()).append('#').append(s);",
      explain: `"${s}" has length ${s.length} → append "${s.length}#${s}".`,
      vars: { s, 's.length()': s.length },
      visuals: [
        arr(chars(encoded), {
          title: 'res',
          states: chars(encoded).map((_, i) =>
            i >= encoded.length - (String(s.length).length + 1 + s.length) ? ('active' as CellState) : ('visited' as CellState),
          ),
        }),
      ],
    });
  }

  r.step({
    at: 'return res.toString();',
    explain: `Encoded string: "${encoded}". Now decode it back.`,
    visuals: [arr(chars(encoded), { title: 'encoded' })],
    result: `encode(…) = "${encoded}"`,
  });

  const str = encoded;
  const res: string[] = [];
  let rp = 0;
  while (rp < str.length) {
    let digits = '';
    const digitStart = rp;
    while (rp < str.length && /[0-9]/.test(str[rp])) {
      digits += str[rp];
      rp++;
    }
    r.step({
      at: ['while (r < str.length() && (Character.isDigit(str.charAt(r))))', 'lengthAsString.append(str.charAt(r));'],
      explain: `Read digits until the "#": the next string is ${digits} characters long.`,
      vars: { r: rp, lengthAsString: digits },
      visuals: [
        arr(chars(str), {
          title: 'str',
          states: chars(str).map((_, i) =>
            i >= digitStart && i < rp ? ('active' as CellState) : i === rp ? ('compare' as CellState) : undefined,
          ),
          pointers: [{ name: 'r', index: rp }],
        }),
        { kind: 'text', title: 'res', chips: true, emptyHint: '[]', lines: res.map((s) => ({ text: `"${s}"` })) },
      ],
    });

    const length = Number(digits);
    const l = rp + 1;
    rp = l + length;
    const word = str.slice(l, rp);
    res.push(word);
    r.step({
      at: ['l = r + 1;', 'r = l + length;', 'res.add(str.substring(l, r));'],
      explain: `Skip the "#", then take the next ${length} characters: "${word}".`,
      vars: { l, r: rp, length, res: `[${res.map((s) => `"${s}"`).join(', ')}]` },
      visuals: [
        arr(chars(str), {
          title: 'str',
          states: chars(str).map((_, i) => (i >= l && i < rp ? ('success' as CellState) : i < l ? ('visited' as CellState) : undefined)),
          pointers: [
            { name: 'l', index: l, tone: 3 },
            { name: 'r', index: Math.min(rp, str.length), tone: 2 },
          ],
        }),
        { kind: 'text', title: 'res', chips: true, lines: res.map((s) => ({ text: `"${s}"` })) },
      ],
    });
  }

  r.step({
    at: 'return res;',
    explain: 'The decoded list matches the original input exactly.',
    visuals: [{ kind: 'text', title: 'res', chips: true, lines: res.map((s) => ({ text: `"${s}"`, state: 'success' as CellState })) }],
    tone: 'success',
    result: `decode(…) = [${res.map((s) => `"${s}"`).join(', ')}]`,
  });
}

/* ── Design HashMap ───────────────────────────────────────────────────────── */

type MapOp = ['put', number, number] | ['get', number] | ['remove', number];

function designHashMap(r: Recorder, ops: MapOp[]) {
  const SLICE = 10;
  const map = new Array(SLICE).fill(-1);
  const view = (key: number, state: CellState): Visual =>
    arr(map, {
      title: 'map[]  (slice 0…9 of 1,000,001 slots)',
      states: at(SLICE, [key], state),
      pointers: [{ name: 'key', index: key }],
    });

  r.step({
    at: ['map = new int[1000001];', 'Arrays.fill(map, -1);'],
    explain:
      'The keys are bounded, so the "hash" can be the key itself: one array slot per key, all pre-filled with −1 to mean "absent".',
    visuals: [arr(map, { title: 'map[]  (slice 0…9 of 1,000,001 slots)' })],
  });

  for (const op of ops) {
    if (op[0] === 'put') {
      map[op[1]] = op[2];
      r.step({
        at: 'map[key] = value;',
        explain: `put(${op[1]}, ${op[2]}) writes straight into slot ${op[1]} — no hashing, no collisions.`,
        vars: { key: op[1], value: op[2] },
        visuals: [view(op[1], 'active')],
      });
    } else if (op[0] === 'get') {
      const v = map[op[1]];
      r.step({
        at: ['if (map[key] != -1) return map[key];', 'else return -1;'],
        explain:
          v === -1
            ? `get(${op[1]}) finds −1, the sentinel for "never written", so it returns −1.`
            : `get(${op[1]}) reads slot ${op[1]} directly and returns ${v}.`,
        vars: { key: op[1], returned: v },
        visuals: [view(op[1], v === -1 ? 'error' : 'success')],
        tone: v === -1 ? 'warn' : 'success',
        result: `get(${op[1]}) = ${v}`,
      });
    } else {
      map[op[1]] = -1;
      r.step({
        at: 'map[key] = -1;',
        explain: `remove(${op[1]}) just resets the slot back to the −1 sentinel.`,
        vars: { key: op[1] },
        visuals: [view(op[1], 'error')],
      });
    }
  }
}

/* ── Design HashSet (bitset) ──────────────────────────────────────────────── */

type SetOp = ['add', number] | ['remove', number] | ['contains', number];

function designHashSet(r: Recorder, ops: SetOp[]) {
  const words = new Map<number, number>();
  const bitsOf = (word: number) =>
    Array.from({ length: 32 }, (_, i) => ((word >> i) & 1 ? 1 : 0));

  const view = (key: number, state: CellState): Visual[] => {
    const wi = Math.floor(key / 32);
    const bit = key % 32;
    const word = words.get(wi) ?? 0;
    return [
      arr(
        [...words.keys()].sort((a, b) => a - b).map((i) => words.get(i)!),
        {
          title: 'set[]  (each int stores 32 keys)',
          labels: [...words.keys()].sort((a, b) => a - b).map((i) => `set[${i}]`),
          indexed: false,
          states: [...words.keys()].sort((a, b) => a - b).map((i) => (i === wi ? state : undefined)),
        },
      ),
      arr(bitsOf(word), {
        title: `set[${wi}] in binary  (bit ${bit} = key ${key})`,
        states: at(32, [bit], state),
        pointers: [{ name: `bit ${bit}`, index: bit }],
      }),
    ];
  };

  r.step({
    at: 'set = new int[31251];',
    explain:
      'Keys go up to 1,000,000. Storing one bit per key inside 32-bit ints needs only 31,251 ints — 32× less memory than a boolean array.',
    visuals: [],
  });

  for (const op of ops) {
    const key = op[1];
    const wi = Math.floor(key / 32);
    const bit = key % 32;
    const word = words.get(wi) ?? 0;

    if (op[0] === 'add') {
      words.set(wi, word | (1 << bit));
      r.step({
        at: ['set[key / 32] |= getMask(key);', 'return 1 << (key % 32);'],
        explain: `add(${key}): word index ${key} / 32 = ${wi}, bit ${key} % 32 = ${bit}. OR-ing with the mask turns that bit on.`,
        vars: { key, 'key / 32': wi, 'key % 32': bit, mask: `1 << ${bit}` },
        visuals: view(key, 'active'),
      });
    } else if (op[0] === 'contains') {
      const present = (word & (1 << bit)) !== 0;
      r.step({
        at: 'return (set[key / 32] & getMask(key)) != 0;',
        explain: `contains(${key}): AND the word with the mask. Bit ${bit} is ${present ? 'on' : 'off'}.`,
        vars: { key, returned: present },
        visuals: view(key, present ? 'success' : 'error'),
        tone: present ? 'success' : 'warn',
        result: `contains(${key}) = ${present}`,
      });
    } else {
      if ((word & (1 << bit)) !== 0) words.set(wi, word ^ (1 << bit));
      r.step({
        at: 'set[key / 32] ^= getMask(key);',
        explain: `remove(${key}): XOR flips bit ${bit} back to 0 (guarded by contains so a missing key is not toggled on).`,
        vars: { key, 'key % 32': bit },
        visuals: view(key, 'error'),
      });
    }
  }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const hashingTracers: Record<string, Tracer> = {
  'easy/hashing/TwoSum': {
    examples: [
      { label: 'nums = [2,7,11,15], target = 9', input: 'nums = [2, 7, 11, 15], target = 9', run: (r) => twoSum(r, [2, 7, 11, 15], 9) },
      { label: 'nums = [3,4,5,6], target = 7', input: 'nums = [3, 4, 5, 6], target = 7', run: (r) => twoSum(r, [3, 4, 5, 6], 7) },
      { label: 'no answer', input: 'nums = [1, 2, 3], target = 99', run: (r) => twoSum(r, [1, 2, 3], 99) },
    ],
  },
  'easy/hashing/ContainsDuplicate': {
    examples: [
      { label: 'has a duplicate', input: 'nums = [1, 2, 3, 1]', run: (r) => containsDuplicate(r, [1, 2, 3, 1]) },
      { label: 'all distinct', input: 'nums = [4, 7, 2, 9]', run: (r) => containsDuplicate(r, [4, 7, 2, 9]) },
    ],
  },
  'easy/hashing/IsAnagram': {
    examples: [
      { label: 'anagram', input: 's = "racecar", t = "carrace"', run: (r) => isAnagram(r, 'racecar', 'carrace') },
      { label: 'not an anagram', input: 's = "jar", t = "jam"', run: (r) => isAnagram(r, 'jar', 'jam') },
      { label: 'different lengths', input: 's = "ab", t = "abc"', run: (r) => isAnagram(r, 'ab', 'abc') },
    ],
  },
  'easy/hashing/LongestPalindrome': {
    examples: [
      { label: 's = "abccccdd"', input: 's = "abccccdd"', run: (r) => longestPalindrome(r, 'abccccdd') },
      { label: 's = "aabb"', input: 's = "aabb"', run: (r) => longestPalindrome(r, 'aabb') },
    ],
  },
  'easy/hashing/DesignHashMap': {
    examples: [
      {
        label: 'put / get / remove',
        input: 'put(1,1), put(2,2), get(1), get(3), put(2,1), get(2), remove(2), get(2)',
        run: (r) =>
          designHashMap(r, [
            ['put', 1, 1],
            ['put', 2, 2],
            ['get', 1],
            ['get', 3],
            ['put', 2, 1],
            ['get', 2],
            ['remove', 2],
            ['get', 2],
          ]),
      },
    ],
  },
  'easy/bitmanipulation/DesignHashSet': {
    examples: [
      {
        label: 'add / contains / remove',
        input: 'add(1), add(70), contains(1), contains(3), remove(1), contains(1)',
        run: (r) =>
          designHashSet(r, [
            ['add', 1],
            ['add', 70],
            ['contains', 1],
            ['contains', 3],
            ['remove', 1],
            ['contains', 1],
          ]),
      },
    ],
  },
  'medium/hashing/GroupAnagrams': {
    examples: [
      {
        label: 'strs = ["act","pots","tops","cat","stop","hat"]',
        input: 'strs = ["act", "pots", "tops", "cat", "stop", "hat"]',
        run: (r) => groupAnagrams(r, ['act', 'pots', 'tops', 'cat', 'stop', 'hat']),
      },
      { label: 'strs = ["x"]', input: 'strs = ["x"]', run: (r) => groupAnagrams(r, ['x']) },
    ],
  },
  'medium/hashing/LongestConsecutiveSequence': {
    examples: [
      { label: 'nums = [2,20,4,10,3,4,5]', input: 'nums = [2, 20, 4, 10, 3, 4, 5]', run: (r) => longestConsecutive(r, [2, 20, 4, 10, 3, 4, 5]) },
      { label: 'nums = [0,3,2,5,4,6,1,1]', input: 'nums = [0, 3, 2, 5, 4, 6, 1, 1]', run: (r) => longestConsecutive(r, [0, 3, 2, 5, 4, 6, 1, 1]) },
    ],
  },
  'medium/hashing/TopKFrequentElements': {
    examples: [
      { label: 'nums = [1,2,2,3,3,3], k = 2', input: 'nums = [1, 2, 2, 3, 3, 3], k = 2', run: (r) => topKFrequent(r, [1, 2, 2, 3, 3, 3], 2) },
      { label: 'nums = [7,7,7,8], k = 1', input: 'nums = [7, 7, 7, 8], k = 1', run: (r) => topKFrequent(r, [7, 7, 7, 8], 1) },
    ],
  },
  'medium/hashing/ValidSudoku': {
    examples: [
      {
        label: 'valid board',
        input: 'a 9×9 board with no repeats',
        run: (r) =>
          validSudoku(
            r,
            [
              ['5', '3', '.', '.', '7', '.', '.', '.', '.'],
              ['6', '.', '.', '1', '9', '5', '.', '.', '.'],
              ['.', '9', '8', '.', '.', '.', '.', '6', '.'],
              ['8', '.', '.', '.', '6', '.', '.', '.', '3'],
              ['4', '.', '.', '8', '.', '3', '.', '.', '1'],
              ['7', '.', '.', '.', '2', '.', '.', '.', '6'],
              ['.', '6', '.', '.', '.', '.', '2', '8', '.'],
              ['.', '.', '.', '4', '1', '9', '.', '.', '5'],
              ['.', '.', '.', '.', '8', '.', '.', '7', '9'],
            ],
          ),
      },
      {
        label: 'duplicate in a square',
        input: 'the same board with an extra 8 in the top-left square',
        run: (r) =>
          validSudoku(
            r,
            [
              ['8', '3', '.', '.', '7', '.', '.', '.', '.'],
              ['6', '.', '8', '1', '9', '5', '.', '.', '.'],
              ['.', '9', '8', '.', '.', '.', '.', '6', '.'],
              ['8', '.', '.', '.', '6', '.', '.', '.', '3'],
              ['4', '.', '.', '8', '.', '3', '.', '.', '1'],
              ['7', '.', '.', '.', '2', '.', '.', '.', '6'],
              ['.', '6', '.', '.', '.', '.', '2', '8', '.'],
              ['.', '.', '.', '4', '1', '9', '.', '.', '5'],
              ['.', '.', '.', '.', '8', '.', '.', '7', '9'],
            ],
          ),
      },
    ],
  },
  'medium/hashing/EncodeAndDecodeStrings': {
    examples: [
      { label: '["neet","code","love","you"]', input: 'strs = ["neet", "code", "love", "you"]', run: (r) => encodeDecode(r, ['neet', 'code', 'love', 'you']) },
      { label: 'with a "#" inside', input: 'strs = ["a#b", "c"]', run: (r) => encodeDecode(r, ['a#b', 'c']) },
    ],
  },
};
