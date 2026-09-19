import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, chars, mapOf, setOf } from './helpers';

/* ── Longest Substring Without Repeating Characters ───────────────────────── */

function lengthOfLongestSubstring(r: Recorder, s: string) {
  const cs = chars(s);
  const set = new Set<string>();
  let l = 0;
  let best = 0;

  const view = (rr: number, state: CellState = 'active', hit?: string): Visual[] => [
    arr(cs, {
      title: 's',
      states: cs.map((_, i) => (i === rr ? state : i >= l && i < rr ? ('window' as CellState) : i < l ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
      window: rr >= l ? { from: l, to: rr, label: `window "${s.slice(l, rr + 1)}" · length ${rr - l + 1}` } : undefined,
    }),
    {
      ...setOf('charSet', set),
      entries: [...set].map((key) => ({ key, state: key === hit ? ('error' as CellState) : undefined })),
    },
  ];

  r.step({
    at: ['Set<Character> charSet = new HashSet<>();', 'int l = 0;'],
    explain: 'Grow the window to the right; whenever it would contain a repeat, shrink it from the left.',
    vars: { l, maxSubstringLength: best },
    visuals: view(0, 'idle'),
  });

  for (let rr = 0; rr < cs.length; rr++) {
    while (set.has(cs[rr])) {
      r.step({
        at: ['while (charSet.contains(s.charAt(r)))', 'charSet.remove(s.charAt(l));'],
        explain: `'${cs[rr]}' is already inside the window, so drop '${cs[l]}' from the left and try again.`,
        vars: { l, r: rr, 's.charAt(r)': cs[rr] },
        visuals: view(rr, 'error', cs[rr]),
        tone: 'warn',
      });
      set.delete(cs[l]);
      l++;
    }
    set.add(cs[rr]);
    const length = rr - l + 1;
    const improved = length > best;
    best = Math.max(best, length);
    r.step({
      at: ['charSet.add(s.charAt(r));', 'maxSubstringLength = Math.max(maxSubstringLength, r - l + 1);'],
      explain: `Window "${s.slice(l, rr + 1)}" has all-distinct characters — length ${length}.${improved ? ' New best.' : ''}`,
      vars: { l, r: rr, length, maxSubstringLength: best },
      visuals: view(rr, 'active'),
      tone: improved ? 'success' : 'neutral',
    });
  }

  r.step({
    at: 'return maxSubstringLength;',
    explain: `The longest window without repeats was ${best} characters.`,
    vars: { maxSubstringLength: best },
    visuals: [arr(cs, { title: 's' })],
    tone: 'success',
    result: `return ${best}`,
  });
}

/* ── Longest Repeating Character Replacement ──────────────────────────────── */

function characterReplacement(r: Recorder, s: string, k: number) {
  const cs = chars(s);
  const count = new Map<string, number>();
  let l = 0;
  let maxFrequency = 0;
  let maxLength = 0;

  const view = (rr: number, state: CellState): Visual[] => [
    arr(cs, {
      title: 's',
      states: cs.map((_, i) => (i === rr ? state : i >= l && i < rr ? ('window' as CellState) : i < l ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
      window: { from: l, to: rr, label: `window "${s.slice(l, rr + 1)}" · size ${rr - l + 1}, replacements needed ${rr - l + 1 - maxFrequency}` },
    }),
    mapOf('count', count),
  ];

  r.step({
    at: ['Map<Character, Integer> count = new HashMap<>();', 'int l = 0, maxFrequency = 0, maxLength = 0;'],
    explain: `A window is valid when (window size − count of its most frequent character) ≤ k = ${k}: those are the characters we would have to replace.`,
    vars: { k, l, maxFrequency, maxLength },
    visuals: [arr(cs, { title: 's' }), mapOf('count', count)],
  });

  for (let rr = 0; rr < cs.length; rr++) {
    count.set(cs[rr], (count.get(cs[rr]) ?? 0) + 1);
    maxFrequency = Math.max(maxFrequency, count.get(cs[rr])!);
    r.step({
      at: ['count.put(s.charAt(r), 1 + count.getOrDefault(s.charAt(r), 0));', 'maxFrequency = Math.max(maxFrequency, count.get(s.charAt(r)));'],
      explain: `Add '${cs[rr]}' to the window. The most frequent character in it now appears ${maxFrequency}×.`,
      vars: { l, r: rr, maxFrequency, needed: rr - l + 1 - maxFrequency, k },
      visuals: view(rr, 'active'),
    });

    while (rr - l + 1 - maxFrequency > k) {
      r.step({
        at: ['while (((r - l + 1) - maxFrequency) > k) {', 'count.put(s.charAt(l), count.get(s.charAt(l)) - 1);'],
        explain: `${rr - l + 1} − ${maxFrequency} = ${rr - l + 1 - maxFrequency} replacements is more than k = ${k}, so drop '${cs[l]}' from the left.`,
        vars: { l, r: rr, maxFrequency, needed: rr - l + 1 - maxFrequency },
        visuals: view(rr, 'error'),
        tone: 'warn',
      });
      count.set(cs[l], count.get(cs[l])! - 1);
      l++;
    }

    const improved = rr - l + 1 > maxLength;
    maxLength = Math.max(maxLength, rr - l + 1);
    r.step({
      at: 'maxLength = Math.max(maxLength, (r - l + 1));',
      explain: `Valid window of size ${rr - l + 1}.${improved ? ' New best.' : ` Best stays ${maxLength}.`}`,
      vars: { l, r: rr, maxLength },
      visuals: view(rr, 'window'),
      tone: improved ? 'success' : 'neutral',
    });
  }

  r.step({
    at: 'return maxLength;',
    explain: `With at most ${k} replacements the longest uniform run is ${maxLength}.`,
    vars: { maxLength },
    visuals: [arr(cs, { title: 's' })],
    tone: 'success',
    result: `return ${maxLength}`,
  });
}

/* ── Permutation in String ────────────────────────────────────────────────── */

function checkInclusion(r: Recorder, s1: string, s2: string) {
  const need = new Array(26).fill(0);
  const window = new Array(26).fill(0);
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const used = [...new Set((s1 + s2).split(''))].map((c) => c.charCodeAt(0) - 97).sort((a, b) => a - b);

  const countView = (values: number[], title: string, highlight?: number): Visual =>
    arr(
      used.map((i) => values[i]),
      {
        title,
        labels: used.map((i) => letters[i]),
        indexed: false,
        states: used.map((i) => (i === highlight ? ('active' as CellState) : values[i] > 0 ? ('compare' as CellState) : undefined)),
      },
    );

  if (s1.length > s2.length) {
    r.step({
      at: 'if (s1.length() > s2.length()) return false;',
      explain: 's1 is longer than s2, so no window of s2 can hold a permutation of it.',
      visuals: [arr(chars(s1), { title: 's1' }), arr(chars(s2), { title: 's2' })],
      tone: 'error',
      result: 'return false',
    });
    return;
  }

  for (const c of s1) need[c.charCodeAt(0) - 97]++;
  r.step({
    at: ["for (char c : s1.toCharArray()) {", "need[c - 'a']++;"],
    explain: `Count what a permutation of "${s1}" needs. A window of s2 matches when its letter counts are identical.`,
    vars: { 's1.length()': s1.length },
    visuals: [arr(chars(s1), { title: 's1' }), countView(need, 'need'), arr(chars(s2), { title: 's2' })],
  });

  let left = 0;
  for (let right = 0; right < s2.length; right++) {
    const ci = s2.charCodeAt(right) - 97;
    window[ci]++;
    r.step({
      at: "window[s2.charAt(right) - 'a']++;",
      explain: `Extend the window with '${s2[right]}'.`,
      vars: { left, right, window: `size ${right - left + 1}` },
      visuals: [
        arr(chars(s2), {
          title: 's2',
          states: chars(s2).map((_, i) => (i === right ? ('active' as CellState) : i >= left && i < right ? ('window' as CellState) : undefined)),
          pointers: [
            { name: 'left', index: left },
            { name: 'right', index: right, tone: 2 },
          ],
        }),
        countView(need, 'need'),
        countView(window, 'window', ci),
      ],
    });

    if (right - left + 1 > s1.length) {
      const li = s2.charCodeAt(left) - 97;
      window[li]--;
      r.step({
        at: ["window[s2.charAt(left) - 'a']--;", 'left++;'],
        explain: `The window grew past ${s1.length} characters, so drop '${s2[left]}' from the left — the window is a fixed-size scanner.`,
        vars: { left: left + 1, right },
        visuals: [
          arr(chars(s2), {
            title: 's2',
            states: chars(s2).map((_, i) => (i === left ? ('error' as CellState) : i > left && i <= right ? ('window' as CellState) : undefined)),
            pointers: [
              { name: 'left', index: left },
              { name: 'right', index: right, tone: 2 },
            ],
          }),
          countView(need, 'need'),
          countView(window, 'window', li),
        ],
      });
      left++;
    }

    if (need.every((v, i) => v === window[i])) {
      r.step({
        at: ['if (Arrays.equals(need, window)) {', 'return true;'],
        explain: `"${s2.slice(left, right + 1)}" has exactly the same letter counts as "${s1}" — it is a permutation.`,
        vars: { left, right, match: s2.slice(left, right + 1) },
        visuals: [
          arr(chars(s2), {
            title: 's2',
            states: chars(s2).map((_, i) => (i >= left && i <= right ? ('success' as CellState) : undefined)),
          }),
          countView(need, 'need'),
          countView(window, 'window'),
        ],
        tone: 'success',
        result: 'return true',
      });
      return;
    }
  }

  r.step({
    at: 'return false;',
    explain: 'No window of s2 ever matched the required letter counts.',
    visuals: [arr(chars(s2), { title: 's2' }), countView(need, 'need'), countView(window, 'window')],
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
          ? ('success' as CellState)
          : i === rr
            ? state
            : i >= l && i < rr
              ? ('window' as CellState)
              : i < l
                ? ('muted' as CellState)
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
          state: countT.has(key) ? (value >= countT.get(key)! ? ('success' as CellState) : ('compare' as CellState)) : undefined,
        })),
    },
  ];

  r.step({
    at: ['Map<Character, Integer> countT = new HashMap<>();', 'int have = 0, minSoFar = Integer.MAX_VALUE, need = countT.size();'],
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
        states: cs.map((_, i) => (res[0] >= 0 && i >= res[0] && i <= res[1] ? ('success' as CellState) : ('muted' as CellState))),
      }),
    ],
    tone: answer ? 'success' : 'error',
    result: `return "${answer}"`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const slidingWindowTracers: Record<string, Tracer> = {
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
};
