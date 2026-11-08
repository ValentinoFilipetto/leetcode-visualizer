import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, bars, chars, deque, mapOf, setOf } from './helpers';

/* ── Best Time to Buy and Sell Stock ──────────────────────────────────────── */

function maxProfit(r: Recorder, prices: number[]) {
  let curMax = 0;
  let l = 0;
  let rr = 0;

  const view = (state: CellState, profit?: number): Visual[] => [
    bars(prices, {
      title: 'prices',
      states: prices.map((_, i) =>
        i === rr ? state : i === l ? 'window' : i < l ? 'muted' : undefined,
      ),
      pointers: [
        { name: 'l (buy)', index: l, tone: 3 },
        ...(rr < prices.length ? [{ name: 'r (sell)', index: rr, tone: 2 as const }] : []),
      ],
      overlays:
        profit !== undefined && profit > 0
          ? [{ index: l, span: rr - l + 1, from: prices[l], to: prices[rr], tone: 'area', label: `+${profit}` }]
          : [],
      note: `curMax: ${curMax}`,
    }),
  ];

  r.step({
    at: ['int curMax = 0;', 'int l = 0;', 'int r = 0;'],
    explain: 'l is the day we would buy, r the day we would sell. As long as selling on r is not a loss, the window l..r stays open.',
    vars: { l, r: rr, curMax },
    visuals: view('idle'),
  });

  while (rr < prices.length) {
    if (prices[l] > prices[rr]) {
      r.step({
        at: ['if (prices[l] > prices[r]) {', 'l++;', 'r = l;'],
        explain: `Day ${rr} (${prices[rr]}) is cheaper than the buy day ${l} (${prices[l]}), so no profit is possible from day ${l}. Move l forward by one and restart r right after it.`,
        vars: { l, r: rr, 'prices[l]': prices[l], 'prices[r]': prices[rr], curMax },
        visuals: view('error'),
        tone: 'warn',
      });
      l++;
      rr = l;
    } else {
      const profit = prices[rr] - prices[l];
      const improved = profit > curMax;
      curMax = Math.max(curMax, profit);
      r.step({
        at: ['int profit = prices[r] - prices[l];', 'curMax = Math.max(curMax, profit);'],
        explain: `Buying on day ${l} at ${prices[l]} and selling on day ${rr} at ${prices[rr]} earns ${profit}.${improved ? ' Best so far.' : ''}`,
        vars: { l, r: rr, profit, curMax },
        visuals: view('success', profit),
        tone: improved ? 'success' : 'neutral',
      });
    }
    rr++;
  }

  r.step({
    at: 'return curMax;',
    explain: `r has run past the last day: the best achievable profit is ${curMax}.`,
    vars: { curMax },
    visuals: [bars(prices, { title: 'prices' })],
    tone: 'success',
    result: `return ${curMax}`,
  });
}

/* ── Contains Duplicate II ────────────────────────────────────────────────── */

function containsNearbyDuplicate(r: Recorder, nums: number[], k: number) {
  const seen = new Set<number>();
  let l = 0;
  let rr = 0;

  const view = (state: CellState, extra: Record<number, CellState> = {}, hit?: number): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, i) =>
        extra[i] ?? (i === rr ? state : i >= l && i < rr ? 'window' : i < l ? 'muted' : undefined),
      ),
      pointers: [
        { name: 'l', index: l },
        ...(rr < nums.length ? [{ name: 'r', index: rr, tone: 2 as const }] : []),
      ],
      window: rr < nums.length ? { from: l, to: rr, label: `r - l = ${rr - l}  (k = ${k})` } : undefined,
    }),
    {
      ...setOf('seen', seen),
      entries: [...seen].map((key) => ({ key, state: key === hit ? 'success' : undefined })),
    },
  ];

  r.step({
    at: ['Set<Integer> seen = new HashSet<>();', 'int l = 0;'],
    explain: `Two equal values at most k = ${k} apart must both sit in some window with r - l ≤ k. seen holds exactly the values of the window to the left of r.`,
    vars: { k, l, r: rr },
    visuals: view('idle'),
  });

  while (rr < nums.length) {
    if (rr - l > k) {
      r.step({
        at: ['if (r - l > k) {', 'seen.remove(nums[l]);', 'l++;'],
        explain: `r - l = ${rr - l} exceeds k = ${k}: nums[${l}] = ${nums[l]} is now too far from r to count, so forget it.`,
        vars: { l, r: rr, 'r - l': rr - l, k },
        visuals: view('active', { [l]: 'error' }),
        tone: 'warn',
      });
      seen.delete(nums[l]);
      l++;
    }

    if (seen.size > 0 && seen.has(nums[rr])) {
      const j = nums.findIndex((v, i) => i >= l && i < rr && v === nums[rr]);
      r.step({
        at: 'if (!seen.isEmpty() && seen.contains(nums[r])) return true;',
        explain: `${nums[rr]} is already in the window: indices ${j} and ${rr} are ${rr - j} ≤ ${k} apart.`,
        vars: { l, r: rr, 'nums[r]': nums[rr] },
        visuals: view('success', { [j]: 'success' }, nums[rr]),
        tone: 'success',
        result: 'return true',
      });
      return;
    }

    seen.add(nums[rr]);
    r.step({
      at: ['seen.add(nums[r]);', 'r++;'],
      explain: `${nums[rr]} has no twin within the last ${k} positions. Remember it and extend the window.`,
      vars: { l, r: rr, 'nums[r]': nums[rr] },
      visuals: view('active'),
    });
    rr++;
  }

  r.step({
    at: 'return false;',
    explain: `r reached the end without ever meeting a value already in its window: no duplicates within distance ${k}.`,
    visuals: [arr(nums, { title: 'nums' }), setOf('seen', seen)],
    tone: 'error',
    result: 'return false',
  });
}

/* ── Sliding Window Maximum ───────────────────────────────────────────────── */

function maxSlidingWindow(r: Recorder, nums: number[], k: number) {
  const res: (number | string)[] = new Array(nums.length - k + 1).fill('—');
  const q: number[] = []; // indices, values strictly decreasing front -> back
  let l = 0;
  let rr = 0;

  const view = (extra: Record<number, CellState> = {}, resHighlight?: number): Visual[] => {
    const inQ = new Set(q);
    return [
      arr(nums, {
        title: 'nums',
        states: nums.map((_, i) =>
          extra[i] ??
          (i > rr ? undefined : i < l ? 'muted' : inQ.has(i) ? 'window' : 'visited'),
        ),
        pointers: [
          { name: 'l', index: l },
          ...(rr < nums.length ? [{ name: 'r', index: rr, tone: 2 as const }] : []),
        ],
        window: rr < nums.length ? { from: l, to: rr, label: rr - l + 1 >= k ? `window [${l}..${rr}]` : 'filling first window' } : undefined,
      }),
      deque('q  (front = max)', q.map((i) => `${i}: ${nums[i]}`), { emptyHint: 'empty' }),
      arr(res, {
        title: 'res',
        states: res.map((_, i) => (i === resHighlight ? 'success' : i < l ? 'done' : undefined)),
      }),
    ];
  };

  r.step({
    at: ['int[] res = new int[nums.length - k + 1];', 'Deque<Integer> q = new ArrayDeque<>();'],
    explain: `There are ${nums.length} - ${k} + 1 = ${res.length} windows of size ${k}. The deque keeps indices whose values strictly decrease from front to back, so the window's max is always at the front.`,
    vars: { k, l, r: rr },
    visuals: view(),
  });

  while (rr < nums.length) {
    const popped: number[] = [];
    while (q.length > 0 && nums[q[q.length - 1]] < nums[rr]) popped.push(q.pop()!);
    q.push(rr);
    r.step({
      at: ['while (!q.isEmpty() && nums[q.getLast()] < nums[r]) q.removeLast();', 'q.addLast(r);'],
      explain: popped.length
        ? `nums[${rr}] = ${nums[rr]} beats ${popped.map((i) => `nums[${i}] = ${nums[i]}`).join(', ')}. Those are smaller and leave the window sooner, so they can never be a max again: drop them from the back.`
        : `Nothing at the back of the deque is smaller than ${nums[rr]}, so just append index ${rr}: it may become the max once the bigger values ahead of it leave.`,
      vars: { l, r: rr, 'nums[r]': nums[rr] },
      visuals: view({ [rr]: 'active', ...Object.fromEntries(popped.map((i) => [i, 'error'])) }),
    });

    if (l > q[0]) {
      const out = q.shift()!;
      r.step({
        at: 'if (l > q.getFirst()) q.removeFirst();',
        explain: `The front index ${out} is left of l = ${l}: it fell out of the window, so it can't be this window's max.`,
        vars: { l, r: rr, 'q.getFirst()': out },
        visuals: view({ [out]: 'error' }),
        tone: 'warn',
      });
    }

    if (rr + 1 >= k) {
      res[l] = nums[q[0]];
      r.step({
        at: ['if ((r + 1) >= k) {', 'res[l] = nums[q.getFirst()];'],
        explain: `Window [${l}..${rr}] is full. Its max is at the front of the deque: nums[${q[0]}] = ${nums[q[0]]}.`,
        vars: { l, r: rr, 'q.getFirst()': q[0], [`res[${l}]`]: nums[q[0]] },
        visuals: view({ [q[0]]: 'success' }, l),
        tone: 'success',
      });
      l++;
    }
    rr++;
  }

  r.step({
    at: 'return res;',
    explain: 'Each index enters and leaves the deque at most once, so the whole pass is amortized O(n).',
    visuals: [arr(nums, { title: 'nums' }), arr(res, { title: 'res', states: res.map(() => 'done') })],
    tone: 'success',
    result: `return [${res.join(', ')}]`,
  });
}

/* ── Longest Substring Without Repeating Characters ───────────────────────── */

function lengthOfLongestSubstring(r: Recorder, s: string) {
  const cs = chars(s);
  const window = new Set<string>();
  let currMax = 0;
  let l = 0;
  let rr = 0;

  const view = (state: CellState = 'active', hit?: string): Visual[] => [
    arr(cs, {
      title: 's',
      states: cs.map((_, i) => (i === rr ? state : i >= l && i < rr ? 'window' : i < l ? 'muted' : undefined)),
      pointers: [
        { name: 'l', index: l },
        ...(rr < cs.length ? [{ name: 'r', index: rr, tone: 2 as const }] : []),
      ],
      window: window.size > 0 ? { from: l, to: l + window.size - 1, label: `window "${[...window].join('')}" · size ${window.size}` } : undefined,
    }),
    {
      ...setOf('window', window),
      entries: [...window].map((key) => ({ key, state: key === hit ? 'error' : undefined })),
    },
  ];

  r.step({
    at: ['Set<Character> window = new HashSet<>();', 'Integer currMax = 0;', 'int l = 0;', 'int r = 0;'],
    explain: 'The set holds exactly the characters of s[l..r-1]. Grow it to the right; whenever the next character is already inside, shrink from the left until it is not.',
    vars: { l, r: rr, currMax },
    visuals: view('idle'),
  });

  while (rr < cs.length) {
    const curr = cs[rr];
    while (window.has(curr)) {
      r.step({
        at: ['while (window.contains(curr)) {', 'window.remove(s.charAt(l));', 'l++;'],
        explain: `'${curr}' is already inside the window, so adding it would make a repeat. Drop '${cs[l]}' from the left and check again.`,
        vars: { l, r: rr, curr },
        visuals: view('error', curr),
        tone: 'warn',
      });
      window.delete(cs[l]);
      l++;
    }
    window.add(curr);
    const improved = window.size > currMax;
    currMax = Math.max(currMax, window.size);
    r.step({
      at: ['char curr = s.charAt(r);', 'window.add(curr);', 'currMax = Math.max(currMax, window.size());'],
      explain: `Window "${s.slice(l, rr + 1)}" has all-distinct characters, so its size is just the set's size: ${window.size}.${improved ? ' New best.' : ''}`,
      vars: { l, r: rr, curr, 'window.size()': window.size, currMax },
      visuals: view('active'),
      tone: improved ? 'success' : 'neutral',
    });
    rr++;
  }

  r.step({
    at: 'return currMax;',
    explain: `r ran off the end. The longest window without repeats was ${currMax} characters.`,
    vars: { currMax },
    visuals: [arr(cs, { title: 's' })],
    tone: 'success',
    result: `return ${currMax}`,
  });
}

/* ── Longest Repeating Character Replacement ──────────────────────────────── */

function characterReplacement(r: Recorder, s: string, k: number) {
  const cs = chars(s);
  const window = new Map<string, number>();
  let currMax = 0;
  let l = 0;
  let rr = 0;
  const maxCount = () => Math.max(...window.values());

  const view = (state: CellState): Visual[] => {
    const top = maxCount();
    return [
      arr(cs, {
        title: 's',
        states: cs.map((_, i) => (i === rr ? state : i >= l && i < rr ? 'window' : i < l ? 'muted' : undefined)),
        pointers: [
          { name: 'l', index: l },
          { name: 'r', index: rr, tone: 2 },
        ],
        window: { from: l, to: rr, label: `size ${rr - l + 1} − max count ${top} = ${rr - l + 1 - top} to replace` },
      }),
      {
        ...mapOf('window', window),
        entries: [...window].map(([key, value]) => ({ key, value, state: value === top ? 'compare' : undefined })),
      },
    ];
  };

  r.step({
    at: ['Map<Character, Integer> window = new HashMap<>();', 'int currMax = 0;', 'int l = 0;', 'int r = 0;'],
    explain: `A window is valid when (window size − count of its most frequent character) ≤ k = ${k}: everything except the most frequent character has to be replaced.`,
    vars: { k, l, r: rr, currMax },
    visuals: [arr(cs, { title: 's' }), mapOf('window', window)],
  });

  while (rr < cs.length) {
    window.set(cs[rr], (window.get(cs[rr]) ?? 0) + 1);
    r.step({
      at: 'window.put(s.charAt(r), window.getOrDefault(s.charAt(r), 0) + 1);',
      explain: `Always add '${cs[rr]}' first, then check whether the window needs shrinking. The most frequent character now appears ${maxCount()}×.`,
      vars: { l, r: rr, 'Collections.max(window.values())': maxCount(), toReplace: rr - l + 1 - maxCount(), k },
      visuals: view('active'),
    });

    while (rr - l + 1 - maxCount() > k) {
      const need = rr - l + 1 - maxCount();
      r.step({
        at: ['while (((r - l + 1) - Collections.max(window.values())) > k) {', 'window.put(s.charAt(l), window.get(s.charAt(l)) - 1);', 'l++;'],
        explain: `${rr - l + 1} − ${maxCount()} = ${need} replacements is more than k = ${k}, so drop '${cs[l]}' from the left.`,
        vars: { l, r: rr, 'Collections.max(window.values())': maxCount(), toReplace: need },
        visuals: view('error'),
        tone: 'warn',
      });
      window.set(cs[l], window.get(cs[l])! - 1);
      l++;
    }

    const improved = rr - l + 1 > currMax;
    currMax = Math.max(currMax, rr - l + 1);
    r.step({
      at: ['currMax = Math.max(currMax, r - l + 1);', 'r++;'],
      explain: `Window "${s.slice(l, rr + 1)}" can be made uniform with at most ${k} replacements — size ${rr - l + 1}.${improved ? ' New best.' : ` Best stays ${currMax}.`}`,
      vars: { l, r: rr, currMax },
      visuals: view('window'),
      tone: improved ? 'success' : 'neutral',
    });
    rr++;
  }

  r.step({
    at: 'return currMax;',
    explain: `With at most ${k} replacements the longest uniform run is ${currMax}.`,
    vars: { currMax },
    visuals: [arr(cs, { title: 's' })],
    tone: 'success',
    result: `return ${currMax}`,
  });
}

/* ── Permutation in String ────────────────────────────────────────────────── */

function checkInclusion(r: Recorder, s1: string, s2: string) {
  const s1Count = new Array(26).fill(0);
  const s2Count = new Array(26).fill(0);
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const used = [...new Set((s1 + s2).split(''))].map((c) => c.charCodeAt(0) - 97).sort((a, b) => a - b);

  const countView = (values: number[], title: string, highlight?: number, hlState: CellState = 'active'): Visual =>
    arr(
      used.map((i) => values[i]),
      {
        title,
        labels: used.map((i) => letters[i]),
        indexed: false,
        states: used.map((i) => (i === highlight ? hlState : values[i] > 0 ? 'compare' : undefined)),
      },
    );

  if (s2.length < s1.length) {
    r.step({
      at: 'if (s2.length() < s1.length()) return false;',
      explain: 's1 is longer than s2, so no window of s2 can hold a permutation of it.',
      visuals: [arr(chars(s1), { title: 's1' }), arr(chars(s2), { title: 's2' })],
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  let l = 0;
  let rr = 0;
  for (const c of s1) s1Count[c.charCodeAt(0) - 97]++;
  r.step({
    at: ['int l = 0;', 'int r = 0;', "for (char c : s1.toCharArray()) s1Count[c - 'a']++;"],
    explain: `Count what a permutation of "${s1}" needs. A window of s2 matches when its letter counts are identical — order doesn't matter.`,
    vars: { l, r: rr, 's1.length()': s1.length },
    visuals: [arr(chars(s1), { title: 's1' }), countView(s1Count, 's1Count'), arr(chars(s2), { title: 's2' })],
  });

  const s2View = (states: (i: number) => CellState | undefined) =>
    arr(chars(s2), {
      title: 's2',
      states: chars(s2).map((_, i) => states(i)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
    });

  while (rr < s2.length) {
    if (rr + 1 > s1.length) {
      const li = s2.charCodeAt(l) - 97;
      s2Count[li]--;
      r.step({
        at: ['if (r + 1 > s1.length()) {', "s2Count[s2.charAt(l) - 'a']--;", 'l++;'],
        explain: `Taking s2[${rr}] would make the window longer than ${s1.length}, so first drop '${s2[l]}' from the left — the window is a fixed-size scanner.`,
        vars: { l, r: rr, 'r + 1': rr + 1, 's1.length()': s1.length },
        visuals: [
          s2View((i) => (i === l ? 'error' : i > l && i < rr ? 'window' : undefined)),
          countView(s1Count, 's1Count'),
          countView(s2Count, 's2Count', li, 'error'),
        ],
        tone: 'warn',
      });
      l++;
    }

    const ci = s2.charCodeAt(rr) - 97;
    s2Count[ci]++;
    const match = s1Count.every((v, i) => v === s2Count[i]);
    r.step({
      at: ["s2Count[s2.charAt(r) - 'a']++;", 'if (Arrays.equals(s1Count, s2Count)) return true;'],
      explain: match
        ? `"${s2.slice(l, rr + 1)}" has exactly the same letter counts as "${s1}" — it is a permutation.`
        : `Add '${s2[rr]}'. The counts of "${s2.slice(l, rr + 1)}" don't equal s1's yet, so keep sliding.`,
      vars: { l, r: rr, window: s2.slice(l, rr + 1) },
      visuals: [
        s2View((i) => (match && i >= l && i <= rr ? 'success' : i === rr ? 'active' : i >= l && i < rr ? 'window' : undefined)),
        countView(s1Count, 's1Count'),
        countView(s2Count, 's2Count', ci),
      ],
      tone: match ? 'success' : 'neutral',
      result: match ? 'return true' : undefined,
    });
    if (match) return;
    rr++;
  }

  r.step({
    at: 'return false;@2',
    explain: 'No window of s2 ever matched the required letter counts.',
    visuals: [arr(chars(s2), { title: 's2' }), countView(s1Count, 's1Count'), countView(s2Count, 's2Count')],
    tone: 'error',
    result: 'return false',
  });
}

/* ── Minimum Window Substring ─────────────────────────────────────────────── */

function minWindow(r: Recorder, s: string, t: string) {
  const cs = chars(s);
  if (s.length < t.length || t.length === 0) {
    r.step({
      at: 'if (s.length() < t.length() || t.isEmpty()) return "";',
      explain: 's is shorter than t (or t is empty), so no window can contain t.',
      visuals: [arr(cs, { title: 's' })],
      tone: 'error',
      result: 'return ""',
    });
    return;
  }

  const countT = new Map<string, number>();
  for (const c of t) countT.set(c, (countT.get(c) ?? 0) + 1);

  let have = 0;
  let minSoFar = Infinity;
  const need = countT.size;
  const window = new Map<string, number>();
  const res: [number, number] = [-1, -1];
  let l = 0;

  const view = (rr: number, state: CellState): Visual[] => [
    arr(cs, {
      title: 's',
      states: cs.map((_, i) =>
        res[0] >= 0 && i >= res[0] && i <= res[1] && have === need
          ? 'success'
          : i === rr
            ? state
            : i >= l && i < rr
              ? 'window'
              : i < l
                ? 'muted'
                : undefined,
      ),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: Math.min(rr, cs.length - 1), tone: 2 },
      ],
      window: { from: l, to: rr, label: `window "${s.slice(l, rr + 1)}"` },
    }),
    mapOf(`countT  (need ${need} distinct chars)`, countT),
    {
      ...mapOf('window', window),
      entries: [...window]
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          key,
          value,
          state: countT.has(key) ? (value >= countT.get(key)! ? 'success' : 'compare') : undefined,
        })),
    },
  ];

  r.step({
    at: ['Map<Character, Integer> countT = new HashMap<>();', 'int have = 0;', 'int minSoFar = Integer.MAX_VALUE;', 'int need = countT.size();'],
    explain: `t = "${t}" needs ${need} distinct characters at the right frequencies. "have" counts how many of them the window already satisfies.`,
    vars: { need, have, minSoFar: '∞' },
    visuals: view(0, 'idle'),
  });

  for (let rr = 0; rr < cs.length; rr++) {
    const c = cs[rr];
    window.set(c, (window.get(c) ?? 0) + 1);
    if (countT.has(c) && countT.get(c) === window.get(c)) have++;
    r.step({
      at: ['window.put(characterS, 1 + window.getOrDefault(characterS, 0));', 'if (countT.containsKey(characterS) && countT.get(characterS).equals(window.get(characterS))) {'],
      explain: countT.has(c)
        ? `'${c}' is needed; the window now has ${window.get(c)} of the ${countT.get(c)} required. have = ${have}/${need}.`
        : `'${c}' is not in t — it only widens the window.`,
      vars: { l, r: rr, have, need },
      visuals: view(rr, 'active'),
    });

    while (have === need) {
      if (rr - l + 1 < minSoFar) {
        minSoFar = rr - l + 1;
        res[0] = l;
        res[1] = rr;
        r.step({
          at: ['if ((r - l + 1) < minSoFar) {', 'minSoFar = (r - l + 1);'],
          explain: `The window "${s.slice(l, rr + 1)}" covers all of t and is the shortest so far (${minSoFar}).`,
          vars: { l, r: rr, minSoFar, res: `[${res[0]}, ${res[1]}]` },
          visuals: view(rr, 'success'),
          tone: 'success',
        });
      }
      const leftChar = cs[l];
      window.set(leftChar, window.get(leftChar)! - 1);
      const lost = countT.has(leftChar) && window.get(leftChar)! < countT.get(leftChar)!;
      if (lost) have--;
      r.step({
        at: ['char leftChar = s.charAt(l);', 'window.put(leftChar, window.get(leftChar) - 1);', 'l++;'],
        explain: lost
          ? `Dropping '${leftChar}' breaks the requirement for it, so have falls to ${have} and the window must grow again.`
          : `'${leftChar}' was surplus — drop it and keep shrinking.`,
        vars: { l: l + 1, r: rr, have, need },
        visuals: view(rr, lost ? 'error' : 'window'),
        tone: lost ? 'warn' : 'neutral',
      });
      l++;
    }
  }

  const answer = minSoFar === Infinity ? '' : s.slice(res[0], res[1] + 1);
  r.step({
    at: 'return minSoFar == Integer.MAX_VALUE ? "" : s.substring(res[0], res[1] + 1);',
    explain: answer ? `The smallest window containing every character of "${t}" is "${answer}".` : 'No window ever contained all of t.',
    vars: { minSoFar: minSoFar === Infinity ? '∞' : minSoFar, res: `[${res[0]}, ${res[1]}]` },
    visuals: [
      arr(cs, {
        title: 's',
        states: cs.map((_, i) => (res[0] >= 0 && i >= res[0] && i <= res[1] ? 'success' : 'muted')),
      }),
    ],
    tone: answer ? 'success' : 'error',
    result: `return "${answer}"`,
  });
}

/* ── Cheapest Flight in Every Window ──────────────────────────────────────── */

function cheapestFlights(r: Recorder, prices: Record<number, number>, dayRange: number, startDay: number, endDay: number) {
  const span = endDay - startDay + 1;
  const res = new Map<string, string>();
  const days = Array.from({ length: Math.max(span, 0) }, (_, i) => startDay + i);
  const has = (i: number) => prices[startDay + i] !== undefined;
  const price: number[] = new Array(Math.max(span, 0)).fill(0);
  const dq: number[] = []; // offsets, prices strictly increasing front -> back
  const view = (i: number, extra: Record<number, CellState> = {}, best?: number): Visual[] => {
    const windowStart = i - dayRange + 1;
    const inDq = new Set(dq);
    return [
      arr(
        days.map((d, j) => (has(j) ? prices[d] : '—')),
        {
          title: 'price by day',
          labels: days.map((d) => `day ${d}`),
          states: days.map((_, j) =>
            extra[j] ??
            (j === best
              ? 'success'
              : j > i
                ? undefined
                : !has(j)
                  ? 'muted'
                  : j < windowStart
                    ? 'muted'
                    : inDq.has(j)
                      ? 'window'
                      : 'visited'),
          ),
          pointers: i >= 0 && i < span ? [{ name: 'i', index: i, tone: 2 }] : [],
          window:
            i >= 0 && i < span ? { from: Math.max(windowStart, 0), to: i, label: windowStart >= 0 ? `window ${startDay + windowStart}-${startDay + i}` : 'filling first window' } : undefined,
        },
      ),
      deque('dq  (front = cheapest)', dq.map((j) => `day ${startDay + j} · ${price[j]}`), { emptyHint: 'empty' }),
      mapOf('res', res),
    ];
  };

  r.step({
    at: ['int span = endDay - startDay + 1;', 'Map<Integer, Map<String, Integer>> flights = getFlights(startDay, endDay);'],
    explain: `Slide a ${dayRange}-day window over days ${startDay}-${endDay}. A deque of days with strictly increasing prices keeps the window's cheapest day at the front at all times.`,
    vars: { dayRange, startDay, endDay, span },
    visuals: view(-1),
  });

  for (let i = 0; i < span; i++) {
    const day = startDay + i;
    const windowStart = i - dayRange + 1;
    const filling = i + 1 < dayRange ? ` Only ${i + 1} of ${dayRange} days seen, so the first window isn't full yet: skip the answer.` : '';
    const skipLine = i + 1 < dayRange ? ['if (i + 1 >= dayRange) {'] : [];

    if (has(i)) {
      const p = prices[day];
      price[i] = p;
      const popped: number[] = [];
      while (dq.length > 0 && price[dq[dq.length - 1]] > p) popped.push(dq.pop()!);
      const tie = dq.length > 0 && price[dq[dq.length - 1]] === p;
      dq.push(i);
      r.step({
        at: ['if (flightMap != null && flightMap.get(PRICE) != null) {', 'while (!dq.isEmpty() && prices[dq.peekLast()] > price) dq.removeLast();', 'dq.addLast(i);', ...skipLine],
        explain:
          (popped.length
            ? `Day ${day} costs ${p}, cheaper than ${popped.map((j) => `day ${startDay + j} (${price[j]})`).join(', ')}. Those can never be a window's cheapest again — day ${day} is cheaper and stays longer — so drop them from the back.`
            : `Day ${day} costs ${p}. Nothing at the back is pricier, so just append it${tie ? ` — day ${startDay + dq[dq.length - 2]} costs the same and stays in front, so ties go to the earliest day` : ''}.`) + filling,
        vars: { i, day, price: p, windowStart },
        visuals: view(i, { [i]: 'active', ...Object.fromEntries(popped.map((j) => [j, 'error'])) }),
      });
    } else {
      r.step({
        at: ['Map<String, Integer> flightMap = flights.get(startDay + i);', ...skipLine],
        explain: `No flight on day ${day}. The day still counts towards the window, it just can't be the answer.${filling}`,
        vars: { i, day, windowStart },
        visuals: view(i, { [i]: 'muted' }),
      });
    }
    if (i + 1 < dayRange) continue;

    const expired: number[] = [];
    while (dq.length > 0 && dq[0] < windowStart) expired.push(dq.shift()!);
    const expiredText = expired.length ? `Day(s) ${expired.map((j) => startDay + j).join(', ')} fell off the left edge, so pop them from the front. ` : '';
    const key = `${startDay + windowStart}-${day}`;

    if (dq.length > 0) {
      const best = dq[0];
      res.set(key, `day ${startDay + best}, price ${price[best]}`);
      r.step({
        at: ['if (i + 1 >= dayRange) {', 'while (!dq.isEmpty() && dq.peekFirst() < windowStart) dq.removeFirst();', 'int best = dq.peekFirst();', 'res.put((startDay + windowStart) + "-" + (startDay + i),'],
        explain: `${expiredText}The front of the deque is the cheapest day still inside ${key}: day ${startDay + best} at ${price[best]}.`,
        vars: { windowStart, i, best: startDay + best, price: price[best] },
        visuals: view(i, {}, best),
        tone: 'success',
      });
    } else {
      r.step({
        at: ['if (i + 1 >= dayRange) {', 'while (!dq.isEmpty() && dq.peekFirst() < windowStart) dq.removeFirst();', 'if (!dq.isEmpty()) {'],
        explain: `${expiredText}The deque is empty: there are no flights at all in ${key}, so the window is omitted.`,
        vars: { windowStart, i },
        visuals: view(i),
        tone: 'warn',
      });
    }
  }

  r.step({
    at: 'return res;',
    explain: 'Every full window has been answered. Each day entered and left the deque at most once, so the whole pass is O(n).',
    visuals: [mapOf('res', res)],
    tone: 'success',
    result: `return {${[...res].map(([k, v]) => `"${k}": ${v}`).join(', ')}}`,
  });
}

/* ── Minimum Size Subarray Sum ────────────────────────────────────────────── */

function minSubArrayLen(r: Recorder, target: number, nums: number[]) {
  let currMin = Infinity;
  let windowSum = 0;
  let l = 0;
  let rr = 0;
  const show = (v: number) => (v === Infinity ? 'MAX_VALUE' : v);

  const view = (state: CellState, best?: [number, number]): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, i) =>
        best && i >= best[0] && i <= best[1] ? 'success' : i === rr ? state : i >= l && i < rr ? 'window' : i < l ? 'muted' : undefined,
      ),
      pointers: [
        { name: 'l', index: l },
        ...(rr < nums.length ? [{ name: 'r', index: rr, tone: 2 as const }] : []),
      ],
      window: rr < nums.length && l <= rr ? { from: l, to: rr, label: `sum ${windowSum} ${windowSum >= target ? '≥' : '<'} target ${target}` } : undefined,
    }),
  ];

  r.step({
    at: ['int currMin = Integer.MAX_VALUE;', 'int windowSum = 0;', 'int l = 0;', 'int r = 0;'],
    explain: `All numbers are positive, so growing the window only raises its sum and shrinking only lowers it. Grow until the sum reaches ${target}, then shrink as far as it stays there.`,
    vars: { target, l, r: rr, windowSum, currMin: show(currMin) },
    visuals: view('idle'),
  });

  while (rr < nums.length) {
    windowSum += nums[rr];
    r.step({
      at: 'windowSum += nums[r];',
      explain: windowSum >= target
        ? `Adding ${nums[rr]} brings the sum to ${windowSum}, which reaches the target. Now try to shrink.`
        : `Adding ${nums[rr]} brings the sum to ${windowSum}, still below ${target}: keep growing.`,
      vars: { l, r: rr, windowSum, currMin: show(currMin) },
      visuals: view('active'),
    });

    while (windowSum >= target) {
      const len = rr - l + 1;
      const improved = len < currMin;
      currMin = Math.min(currMin, len);
      r.step({
        at: ['while (windowSum >= target) {', 'currMin = Math.min(currMin, r - l + 1);'],
        explain: `[${l}..${rr}] sums to ${windowSum} ≥ ${target} with length ${len}.${improved ? ' Shortest so far.' : ` Not shorter than ${currMin}.`}`,
        vars: { l, r: rr, windowSum, length: len, currMin: show(currMin) },
        visuals: view('active', [l, rr]),
        tone: improved ? 'success' : 'neutral',
      });
      const dropped = nums[l];
      windowSum -= nums[l];
      r.step({
        at: ['windowSum -= nums[l];', 'l++;'],
        explain: `Any longer window ending at r is useless now, so drop ${dropped} from the left to see if a shorter one still works. Sum becomes ${windowSum}.`,
        vars: { l, r: rr, windowSum, currMin: show(currMin) },
        visuals: [
          arr(nums, {
            title: 'nums',
            states: nums.map((_, i) => (i === l ? 'error' : i > l && i <= rr ? 'window' : i < l ? 'muted' : undefined)),
            pointers: [
              { name: 'l', index: l },
              { name: 'r', index: rr, tone: 2 },
            ],
          }),
        ],
        tone: 'warn',
      });
      l++;
    }
    rr++;
  }

  const res = currMin === Infinity ? 0 : currMin;
  r.step({
    at: 'return currMin == Integer.MAX_VALUE ? 0 : currMin;',
    explain: currMin === Infinity
      ? `Even the whole array sums to less than ${target}, so currMin never moved off MAX_VALUE: no valid subarray, return 0.`
      : `The shortest subarray with sum ≥ ${target} has length ${currMin}. Each index entered and left the window at most once: O(n).`,
    vars: { currMin: show(currMin) },
    visuals: [arr(nums, { title: 'nums' })],
    tone: currMin === Infinity ? 'error' : 'success',
    result: `return ${res}`,
  });
}

/* ── Find K Closest Elements ──────────────────────────────────────────────── */

function findClosestElements(r: Recorder, nums: number[], k: number, x: number) {
  const dq: number[] = []; // indices into nums; always a contiguous run

  const view = (i: number, extra: Record<number, CellState> = {}): Visual[] => {
    const inDq = new Set(dq);
    return [
      arr(nums, {
        title: 'arr',
        states: nums.map((_, j) => extra[j] ?? (inDq.has(j) ? 'window' : j < i ? 'muted' : undefined)),
        labels: nums.map((v) => `|${v}−${x}|=${Math.abs(v - x)}`),
        pointers: i < nums.length ? [{ name: 'i', index: i, tone: 2 }] : [],
        window: dq.length ? { from: dq[0], to: dq[dq.length - 1], label: `deque · size ${dq.length}` } : undefined,
      }),
      deque('deque', dq.map((j) => nums[j]), { emptyHint: 'empty' }),
    ];
  };

  r.step({
    at: 'Deque<Integer> deque = new ArrayDeque<>();',
    explain: `arr is sorted, so the k closest values to x = ${x} form a contiguous run, and the value farthest from x in any run is one of its two ends. The deque holds the current run.`,
    vars: { k, x },
    visuals: view(0),
  });

  for (let i = 0; i < nums.length; i++) {
    dq.push(i);
    r.step({
      at: ['for (int i = 0; i < arr.length; i++) {', 'deque.addLast(arr[i]);'],
      explain: dq.length > k
        ? `Append ${nums[i]}. The deque now has ${dq.length} > k = ${k} elements, so one end has to go.`
        : `Append ${nums[i]}. The deque has ${dq.length} ≤ k = ${k} elements, nothing to drop yet.`,
      vars: { i, 'arr[i]': nums[i], 'deque.size()': dq.length, k },
      visuals: view(i, { [i]: 'active' }),
    });

    if (dq.length > k) {
      const fi = dq[0];
      const bi = dq[dq.length - 1];
      const a = nums[fi];
      const b = nums[bi];
      const da = Math.abs(a - x);
      const db = Math.abs(b - x);
      const dropBack = da <= db;
      r.step({
        at: dropBack
          ? ['if (deque.size() > k) {', 'int a = deque.peekFirst();', 'int b = deque.peekLast();', 'if (Math.abs(a - x) <= Math.abs(b - x)) deque.removeLast();']
          : ['if (deque.size() > k) {', 'int a = deque.peekFirst();', 'int b = deque.peekLast();', 'else deque.removeFirst();'],
        explain: dropBack
          ? `|${a} − ${x}| = ${da} ≤ |${b} − ${x}| = ${db}${da === db ? ' (a tie goes to the smaller value)' : ''}, so the back ${b} is the worse end: drop it.${da < db ? ' Every later value is even larger, so from here on each new element gets dropped too.' : ''}`
          : `|${a} − ${x}| = ${da} > |${b} − ${x}| = ${db}, so the front ${a} is farther from x: drop it and the run slides right.`,
        vars: { a, b, '|a - x|': da, '|b - x|': db },
        visuals: view(i, { [fi]: dropBack ? 'compare' : 'error', [bi]: dropBack ? 'error' : 'compare' }),
        tone: 'warn',
      });
      if (dropBack) dq.pop();
      else dq.shift();
    }
  }

  const res = dq.map((j) => nums[j]);
  r.step({
    at: 'return new ArrayList<>(deque);',
    explain: `The deque already holds the ${k} closest values in sorted order, because it is a contiguous slice of the sorted array.`,
    vars: { k, x },
    visuals: [
      arr(nums, { title: 'arr', states: nums.map((_, j) => (dq.includes(j) ? 'success' : 'muted')) }),
    ],
    tone: 'success',
    result: `return [${res.join(', ')}]`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const slidingWindowTracers: Record<string, Tracer> = {
  'easy/slidingwindow/BestTimeToBuyAndSellStocks': {
    examples: [
      { label: 'prices = [10,1,5,6,7,1]', input: 'prices = [10, 1, 5, 6, 7, 1]', run: (r) => maxProfit(r, [10, 1, 5, 6, 7, 1]) },
      { label: 'dip after a peak', input: 'prices = [3, 5, 6, 1, 4]', run: (r) => maxProfit(r, [3, 5, 6, 1, 4]) },
      { label: 'falling prices', input: 'prices = [7, 6, 4, 3, 1]', run: (r) => maxProfit(r, [7, 6, 4, 3, 1]) },
    ],
  },
  'easy/slidingwindow/ContainsDuplicateII': {
    examples: [
      { label: 'nums = [1,2,3,1], k = 3', input: 'nums = [1, 2, 3, 1], k = 3', run: (r) => containsNearbyDuplicate(r, [1, 2, 3, 1], 3) },
      { label: 'nums = [2,1,2,3,3], k = 1', input: 'nums = [2, 1, 2, 3, 3], k = 1', run: (r) => containsNearbyDuplicate(r, [2, 1, 2, 3, 3], 1) },
      { label: 'too far apart', input: 'nums = [1, 2, 3, 1, 2, 3], k = 2', run: (r) => containsNearbyDuplicate(r, [1, 2, 3, 1, 2, 3], 2) },
    ],
  },
  'hard/slidingwindow/SlidingWindowMaximum': {
    examples: [
      { label: 'nums = [1,3,-1,-3,5,3,6,7], k = 3', input: 'nums = [1, 3, -1, -3, 5, 3, 6, 7], k = 3', run: (r) => maxSlidingWindow(r, [1, 3, -1, -3, 5, 3, 6, 7], 3) },
      { label: 'max expires from the front', input: 'nums = [9, 5, 4, 3, 2, 8], k = 3', run: (r) => maxSlidingWindow(r, [9, 5, 4, 3, 2, 8], 3) },
    ],
  },
  'medium/slidingwindow/LongestSubstringWithoutRepeatingCharacters': {
    examples: [
      { label: 's = "zxyzxyz"', input: 's = "zxyzxyz"', run: (r) => lengthOfLongestSubstring(r, 'zxyzxyz') },
      { label: 's = "abcabcbb"', input: 's = "abcabcbb"', run: (r) => lengthOfLongestSubstring(r, 'abcabcbb') },
    ],
  },
  'medium/slidingwindow/LongestRepeatingCharacterReplacement': {
    examples: [
      { label: 's = "XYYX", k = 2', input: 's = "XYYX", k = 2', run: (r) => characterReplacement(r, 'XYYX', 2) },
      { label: 's = "AAABABB", k = 1', input: 's = "AAABABB", k = 1', run: (r) => characterReplacement(r, 'AAABABB', 1) },
    ],
  },
  'medium/slidingwindow/PermutationInString': {
    examples: [
      { label: 's1 = "abc", s2 = "lecabee"', input: 's1 = "abc", s2 = "lecabee"', run: (r) => checkInclusion(r, 'abc', 'lecabee') },
      { label: 'no permutation', input: 's1 = "abc", s2 = "lecaabee"', run: (r) => checkInclusion(r, 'abc', 'lecaabee') },
    ],
  },
  'hard/slidingwindow/MinimumWindowSubstring': {
    examples: [
      { label: 's = "OUZODYXAZV", t = "XYZ"', input: 's = "OUZODYXAZV", t = "XYZ"', run: (r) => minWindow(r, 'OUZODYXAZV', 'XYZ') },
      { label: 's = "ADOBECODEBANC", t = "ABC"', input: 's = "ADOBECODEBANC", t = "ABC"', run: (r) => minWindow(r, 'ADOBECODEBANC', 'ABC') },
    ],
  },
  'hard/slidingwindow/CheapestFlightInEveryWindow': {
    examples: [
      { label: 'dayRange = 3, days 3-8', input: 'prices = {3:100, 4:300, 5:500, 6:200, 7:400, 8:100}, dayRange = 3, startDay = 3, endDay = 8', run: (r) => cheapestFlights(r, { 3: 100, 4: 300, 5: 500, 6: 200, 7: 400, 8: 100 }, 3, 3, 8) },
      { label: '10 days, dayRange = 4', input: 'prices = {1:420, 2:310, 3:500, 4:280, 5:650, 6:390, 7:460, 8:600, 9:540, 10:330}, dayRange = 4, startDay = 1, endDay = 10', run: (r) => cheapestFlights(r, { 1: 420, 2: 310, 3: 500, 4: 280, 5: 650, 6: 390, 7: 460, 8: 600, 9: 540, 10: 330 }, 4, 1, 10) },
      { label: 'missing days and a tie', input: 'prices = {1:250, 2:180, 4:180, 5:300, 8:90}, dayRange = 3, startDay = 1, endDay = 9', run: (r) => cheapestFlights(r, { 1: 250, 2: 180, 4: 180, 5: 300, 8: 90 }, 3, 1, 9) },
      { label: 'empty windows are omitted', input: 'prices = {1:120, 5:80}, dayRange = 2, startDay = 1, endDay = 5', run: (r) => cheapestFlights(r, { 1: 120, 5: 80 }, 2, 1, 5) },
    ],
  },
  'medium/slidingwindow/MinimumSizeSubarraySum': {
    examples: [
      { label: 'target = 7, nums = [2,3,1,2,4,3]', input: 'target = 7, nums = [2, 3, 1, 2, 4, 3]', run: (r) => minSubArrayLen(r, 7, [2, 3, 1, 2, 4, 3]) },
      { label: 'single element suffices', input: 'target = 4, nums = [1, 4, 4]', run: (r) => minSubArrayLen(r, 4, [1, 4, 4]) },
      { label: 'no valid subarray', input: 'target = 11, nums = [1, 2, 3, 4]', run: (r) => minSubArrayLen(r, 11, [1, 2, 3, 4]) },
    ],
  },
  'medium/slidingwindow/FindKClosestElements': {
    examples: [
      { label: 'arr = [1,2,3,4,5], k = 4, x = 3', input: 'arr = [1, 2, 3, 4, 5], k = 4, x = 3', run: (r) => findClosestElements(r, [1, 2, 3, 4, 5], 4, 3) },
      { label: 'window slides right', input: 'arr = [1, 3, 5, 7, 9, 11], k = 3, x = 8', run: (r) => findClosestElements(r, [1, 3, 5, 7, 9, 11], 3, 8) },
      { label: 'x below every value', input: 'arr = [2, 4, 6, 8, 10], k = 2, x = 1', run: (r) => findClosestElements(r, [2, 4, 6, 8, 10], 2, 1) },
    ],
  },
};
