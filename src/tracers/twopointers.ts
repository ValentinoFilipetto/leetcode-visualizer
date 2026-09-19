import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, at, bars, chars, chips, list } from './helpers';

/* ── Valid Palindrome ─────────────────────────────────────────────────────── */

const isAlphaNum = (c: string) => /[a-z0-9]/i.test(c);

function validPalindrome(r: Recorder, s: string) {
  const cs = chars(s);
  const view = (l: number, rr: number, states: (CellState | undefined)[] = []): Visual[] => [
    arr(cs, {
      title: 's',
      states: states.length ? states : at(cs.length, [l, rr], 'active'),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
    }),
  ];

  let l = 0;
  let rr = cs.length - 1;
  r.step({
    at: 'int l = 0, r = s.length() - 1;',
    explain: 'One pointer at each end; they walk towards each other comparing characters.',
    vars: { l, r: rr },
    visuals: view(l, rr),
  });

  while (l < rr) {
    while (l < rr && !isAlphaNum(cs[l])) {
      r.step({
        at: 'while (l < r && !isAlphaNum(s.charAt(l))) l++;',
        explain: `'${cs[l]}' is not a letter or digit, so the left pointer skips it.`,
        vars: { l, r: rr, 's.charAt(l)': cs[l] },
        visuals: view(l, rr, at(cs.length, [l], 'muted')),
      });
      l++;
    }
    while (rr > l && !isAlphaNum(cs[rr])) {
      r.step({
        at: 'while (r > l && !isAlphaNum(s.charAt(r))) r--;',
        explain: `'${cs[rr]}' is not a letter or digit, so the right pointer skips it.`,
        vars: { l, r: rr, 's.charAt(r)': cs[rr] },
        visuals: view(l, rr, at(cs.length, [rr], 'muted')),
      });
      rr--;
    }
    if (l >= rr) break;

    const a = cs[l].toLowerCase();
    const b = cs[rr].toLowerCase();
    if (a !== b) {
      r.step({
        at: 'if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r)))',
        explain: `'${a}' ≠ '${b}' — the string cannot be a palindrome.`,
        vars: { l, r: rr, left: a, right: b },
        visuals: view(l, rr, at(cs.length, [l, rr], 'error')),
        tone: 'error',
        result: 'return false',
      });
      return;
    }

    r.step({
      at: ['if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r)))', 'l++; r--;'],
      explain: `'${a}' matches '${b}'. Move both pointers inwards.`,
      vars: { l, r: rr, left: a, right: b },
      visuals: view(l, rr, at(cs.length, [l, rr], 'success')),
    });
    l++;
    rr--;
  }

  r.step({
    at: 'return true;',
    explain: 'The pointers met in the middle with every comparison matching.',
    vars: { l, r: rr },
    visuals: view(Math.min(l, cs.length - 1), Math.max(rr, 0), cs.map(() => 'success' as CellState)),
    tone: 'success',
    result: 'return true',
  });
}

/* ── Valid Palindrome II ──────────────────────────────────────────────────── */

function validPalindromeII(r: Recorder, s: string) {
  const cs = chars(s);
  let left = 0;
  let right = cs.length - 1;

  r.step({
    at: 'int left = 0, right = s.length() - 1;',
    explain: 'Same two-pointer scan, but one mismatch may be repaired by deleting a single character.',
    vars: { left, right },
    visuals: [arr(cs, { title: 's', pointers: [{ name: 'left', index: left }, { name: 'right', index: right, tone: 2 }] })],
  });

  const subCheck = (from: number, to: number, skipped: number, label: string): boolean => {
    let a = from;
    let b = to;
    while (a < b) {
      const ok = cs[a] === cs[b];
      r.step({
        at: ['if (s.charAt(left) != s.charAt(right)) return false;', 'left++;@2'],
        explain: `${label}: compare '${cs[a]}' and '${cs[b]}' — ${ok ? 'they match' : 'mismatch, this branch fails'}.`,
        vars: { left: a, right: b, skipped: `index ${skipped}` },
        visuals: [
          arr(cs, {
            title: 's',
            states: cs.map((_, i) =>
              i === skipped
                ? ('muted' as CellState)
                : i === a || i === b
                  ? ok
                    ? ('success' as CellState)
                    : ('error' as CellState)
                  : undefined,
            ),
            pointers: [
              { name: 'left', index: a },
              { name: 'right', index: b, tone: 2 },
            ],
          }),
        ],
        tone: ok ? 'neutral' : 'warn',
      });
      if (!ok) return false;
      a++;
      b--;
    }
    return true;
  };

  while (left < right) {
    if (cs[left] !== cs[right]) {
      r.step({
        at: 'if (s.charAt(left) != s.charAt(right)) {',
        explain: `'${cs[left]}' ≠ '${cs[right]}'. This is the one deletion we are allowed: try dropping the left character, then the right one.`,
        vars: { left, right },
        visuals: [
          arr(cs, {
            title: 's',
            states: at(cs.length, [left, right], 'error'),
            pointers: [
              { name: 'left', index: left },
              { name: 'right', index: right, tone: 2 },
            ],
          }),
        ],
        tone: 'warn',
      });

      const skipLeft = subCheck(left + 1, right, left, `skip s[${left}] = '${cs[left]}'`);
      const skipRight = skipLeft ? false : subCheck(left, right - 1, right, `skip s[${right}] = '${cs[right]}'`);
      const ok = skipLeft || skipRight;
      r.step({
        at: 'return isPalindrome(s, left + 1, right) || isPalindrome(s, left, right - 1);',
        explain: ok
          ? `Deleting ${skipLeft ? `s[${left}]` : `s[${right}]`} leaves a palindrome.`
          : 'Neither deletion produces a palindrome.',
        visuals: [arr(cs, { title: 's', states: cs.map(() => (ok ? ('success' as CellState) : ('error' as CellState))) })],
        tone: ok ? 'success' : 'error',
        result: `return ${ok}`,
      });
      return;
    }

    r.step({
      at: ['left++;@1', 'right--;@1'],
      explain: `'${cs[left]}' matches '${cs[right]}' — no deletion needed yet.`,
      vars: { left, right },
      visuals: [
        arr(cs, {
          title: 's',
          states: at(cs.length, [left, right], 'success'),
          pointers: [
            { name: 'left', index: left },
            { name: 'right', index: right, tone: 2 },
          ],
        }),
      ],
    });
    left++;
    right--;
  }

  r.step({
    at: 'return true;@2',
    explain: 'The string was already a palindrome; the free deletion was never needed.',
    visuals: [arr(cs, { title: 's', states: cs.map(() => 'success' as CellState) })],
    tone: 'success',
    result: 'return true',
  });
}

/* ── Merge Strings Alternately ────────────────────────────────────────────── */

function mergeAlternately(r: Recorder, w1: string, w2: string) {
  let res = '';
  let i = 0;
  let j = 0;
  const view = (): Visual[] => [
    arr(chars(w1), {
      title: 'word1',
      states: chars(w1).map((_, k) => (k < i ? ('visited' as CellState) : k === i ? ('active' as CellState) : undefined)),
      pointers: i < w1.length ? [{ name: 'i', index: i }] : [],
    }),
    arr(chars(w2), {
      title: 'word2',
      states: chars(w2).map((_, k) => (k < j ? ('visited' as CellState) : k === j ? ('compare' as CellState) : undefined)),
      pointers: j < w2.length ? [{ name: 'j', index: j, tone: 2 }] : [],
    }),
    arr(chars(res), { title: 'res', states: chars(res).map(() => 'success' as CellState) }),
  ];

  r.step({
    at: ['StringBuilder res = new StringBuilder();', 'int i = 0, j = 0;'],
    explain: 'Take one character from each word in turn until one of them runs out.',
    vars: { i, j },
    visuals: view(),
  });

  while (i < w1.length && j < w2.length) {
    res += w1[i] + w2[j];
    const before = { i, j };
    i++;
    j++;
    r.step({
      at: ['res.append(word1.charAt(i++));', 'res.append(word2.charAt(j++));'],
      explain: `Append '${w1[before.i]}' from word1 and '${w2[before.j]}' from word2.`,
      vars: { i, j, res },
      visuals: view(),
    });
  }

  const tail1 = w1.slice(i);
  const tail2 = w2.slice(j);
  res += tail1 + tail2;
  r.step({
    at: ['res.append(word1.substring(i));', 'res.append(word2.substring(j));'],
    explain:
      tail1 || tail2
        ? `One word is exhausted; append the remainder "${tail1 || tail2}" in one go. substring() is safe even when the index equals the length.`
        : 'Both words ended together, so the two substring() calls append nothing.',
    vars: { i, j, res },
    visuals: [arr(chars(res), { title: 'res', states: chars(res).map(() => 'success' as CellState) })],
    tone: 'success',
    result: `return "${res}"`,
  });
}

/* ── Remove Element ───────────────────────────────────────────────────────── */

function removeElement(r: Recorder, nums: number[], val: number) {
  const a = nums.slice();
  let write = 0;
  const view = (read: number, state: CellState): Visual[] => [
    arr(a, {
      title: 'nums',
      states: a.map((_, i) => (i === read ? state : i < write ? ('success' as CellState) : i >= write && i < read ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'write', index: write, tone: 3 },
        ...(read >= 0 && read < a.length ? [{ name: 'read', index: read, above: false as const }] : []),
      ],
    }),
  ];

  r.step({
    at: 'int write = 0;',
    explain: `Compact the array in place: everything different from ${val} is copied to the front.`,
    vars: { val, write },
    visuals: view(-1, 'idle'),
  });

  for (let read = 0; read < a.length; read++) {
    if (a[read] !== val) {
      a[write] = a[read];
      write++;
      r.step({
        at: ['nums[write] = nums[read];', 'write++;'],
        explain: `nums[${read}] = ${a[write - 1]} ≠ ${val}, so it is kept: copy it to index ${write - 1}.`,
        vars: { read, write, val },
        visuals: view(read, 'active'),
      });
    } else {
      r.step({
        at: 'if (nums[read] != val) {',
        explain: `nums[${read}] = ${val} is the value to remove — skip it and leave write where it is.`,
        vars: { read, write, val },
        visuals: view(read, 'error'),
      });
    }
  }

  r.step({
    at: 'return write;',
    explain: `The first ${write} elements are the kept ones; anything past that no longer matters.`,
    vars: { write },
    visuals: [
      arr(a, {
        title: 'nums',
        states: a.map((_, i) => (i < write ? ('success' as CellState) : ('muted' as CellState))),
      }),
    ],
    tone: 'success',
    result: `return ${write}  ·  nums[0…${write - 1}] = ${list(a.slice(0, write))}`,
  });
}

/* ── Rotate Array ─────────────────────────────────────────────────────────── */

function rotateArray(r: Recorder, nums: number[], k: number) {
  const a = nums.slice();
  const n = a.length;
  const kk = k % n;

  r.step({
    at: ['int n = nums.length;', 'k %= n;'],
    explain: `Rotating by k = ${k} on ${n} elements is the same as rotating by ${k} % ${n} = ${kk}.`,
    vars: { n, k: kk },
    visuals: [arr(a, { title: 'nums' })],
  });

  const reverse = (l: number, rr: number, label: string, snippet: string) => {
    r.step({
      at: snippet,
      explain: `${label}: reverse nums[${l}…${rr}].`,
      vars: { l, r: rr },
      visuals: [
        arr(a, {
          title: 'nums',
          states: a.map((_, i) => (i >= l && i <= rr ? ('window' as CellState) : ('muted' as CellState))),
        }),
      ],
    });
    let x = l;
    let y = rr;
    while (x < y) {
      [a[x], a[y]] = [a[y], a[x]];
      r.step({
        at: ['int tmp = nums[l];', 'nums[l] = nums[r];', 'nums[r] = tmp;'],
        explain: `Swap nums[${x}] and nums[${y}].`,
        vars: { l: x, r: y, tmp: a[y] },
        visuals: [
          arr(a, {
            title: 'nums',
            states: a.map((_, i) => (i === x || i === y ? ('active' as CellState) : i >= l && i <= rr ? ('window' as CellState) : ('muted' as CellState))),
            pointers: [
              { name: 'l', index: x },
              { name: 'r', index: y, tone: 2 },
            ],
          }),
        ],
      });
      x++;
      y--;
    }
  };

  reverse(0, n - 1, 'Step 1 — whole array', 'reverse(nums, 0, n - 1);');
  reverse(0, kk - 1, `Step 2 — first ${kk}`, 'reverse(nums, 0, k - 1);');
  reverse(kk, n - 1, `Step 3 — remaining ${n - kk}`, 'reverse(nums, k, n - 1);');

  r.step({
    at: 'public void rotate(int[] nums, int k) {',
    explain: `Three reversals rotate the array in place, using no extra memory.`,
    visuals: [arr(a, { title: 'nums', states: a.map(() => 'success' as CellState) })],
    tone: 'success',
    result: `nums = ${list(a)}`,
  });
}

/* ── Two Sum II ───────────────────────────────────────────────────────────── */

function twoSumII(r: Recorder, numbers: number[], target: number) {
  let l = 0;
  let rr = numbers.length - 1;
  const view = (state: CellState): Visual[] => [
    arr(numbers, {
      title: 'numbers  (sorted)',
      states: numbers.map((_, i) => (i === l || i === rr ? state : i < l || i > rr ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
    }),
  ];

  r.step({
    at: 'int l = 0, r = numbers.length - 1;',
    explain: 'Because the input is sorted, the sum of the outer pair tells us exactly which side to move.',
    vars: { target, l, r: rr },
    visuals: view('active'),
  });

  while (l < rr) {
    const sum = numbers[l] + numbers[rr];
    if (sum > target) {
      r.step({
        at: ['int sum = numbers[l] + numbers[r];', 'if (sum > target) {', 'r--;'],
        explain: `${numbers[l]} + ${numbers[rr]} = ${sum} > ${target}. The sum must shrink, so move r left.`,
        vars: { l, r: rr, sum, target },
        visuals: view('compare'),
      });
      rr--;
    } else if (sum < target) {
      r.step({
        at: ['int sum = numbers[l] + numbers[r];', '} else if (sum < target) {', 'l++;'],
        explain: `${numbers[l]} + ${numbers[rr]} = ${sum} < ${target}. The sum must grow, so move l right.`,
        vars: { l, r: rr, sum, target },
        visuals: view('compare'),
      });
      l++;
    } else {
      r.step({
        at: ['int sum = numbers[l] + numbers[r];', 'return new int[] {l + 1, r + 1};'],
        explain: `${numbers[l]} + ${numbers[rr]} = ${target}. The problem uses 1-based indices, hence l + 1 and r + 1.`,
        vars: { l, r: rr, sum },
        visuals: view('success'),
        tone: 'success',
        result: `return [${l + 1}, ${rr + 1}]`,
      });
      return;
    }
  }

  r.step({
    at: 'return new int[] {};',
    explain: 'The pointers crossed without finding a pair.',
    visuals: view('idle'),
    tone: 'error',
    result: 'return []',
  });
}

/* ── 3Sum ─────────────────────────────────────────────────────────────────── */

function threeSum(r: Recorder, input: number[]) {
  const nums = input.slice().sort((a, b) => a - b);
  const res: number[][] = [];
  const resViz = () => chips('res', res.map((t) => `[${t.join(', ')}]`), { emptyHint: '[]' });

  r.step({
    at: 'Arrays.sort(nums);',
    explain: `Sorting turns the problem into "fix one number, then two-sum the rest": ${list(input)} → ${list(nums)}.`,
    visuals: [arr(nums, { title: 'nums (sorted)' }), resViz()],
  });

  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) {
      r.step({
        at: 'if (i > 0 && nums[i] == nums[i - 1]) continue;',
        explain: `nums[${i}] = ${nums[i]} repeats the previous value — skipping it avoids duplicate triplets.`,
        vars: { i, 'nums[i]': nums[i] },
        visuals: [arr(nums, { title: 'nums (sorted)', states: at(nums.length, [i], 'muted'), pointers: [{ name: 'i', index: i }] }), resViz()],
      });
      continue;
    }

    let l = i + 1;
    let rr = nums.length - 1;
    r.step({
      at: 'int l = i + 1, r = nums.length - 1;',
      explain: `Fix nums[${i}] = ${nums[i]} and two-pointer the rest looking for a sum of ${-nums[i]}.`,
      vars: { i, 'nums[i]': nums[i], l, r: rr },
      visuals: [
        arr(nums, {
          title: 'nums (sorted)',
          states: at(nums.length, [i], 'active'),
          pointers: [
            { name: 'i', index: i },
            { name: 'l', index: l, tone: 3 },
            { name: 'r', index: rr, tone: 2 },
          ],
        }),
        resViz(),
      ],
    });

    while (l < rr) {
      const sum = nums[i] + nums[l] + nums[rr];
      const view = (state: CellState) =>
        arr(nums, {
          title: 'nums (sorted)',
          states: nums.map((_, k) => (k === i ? ('active' as CellState) : k === l || k === rr ? state : undefined)),
          pointers: [
            { name: 'i', index: i },
            { name: 'l', index: l, tone: 3 },
            { name: 'r', index: rr, tone: 2 },
          ],
        });

      if (sum > 0) {
        r.step({
          at: ['int sum = nums[i] + nums[l] + nums[r];', 'if (sum > 0) {', 'r--;@1'],
          explain: `${nums[i]} + ${nums[l]} + ${nums[rr]} = ${sum} > 0 — too big, pull r inwards.`,
          vars: { i, l, r: rr, sum },
          visuals: [view('compare'), resViz()],
        });
        rr--;
      } else if (sum < 0) {
        r.step({
          at: ['int sum = nums[i] + nums[l] + nums[r];', '} else if (sum < 0) {', 'l++;@1'],
          explain: `${nums[i]} + ${nums[l]} + ${nums[rr]} = ${sum} < 0 — too small, push l rightwards.`,
          vars: { i, l, r: rr, sum },
          visuals: [view('compare'), resViz()],
        });
        l++;
      } else {
        res.push([nums[i], nums[l], nums[rr]]);
        r.step({
          at: 'res.add(Arrays.asList(nums[i], nums[l], nums[r]));',
          explain: `${nums[i]} + ${nums[l]} + ${nums[rr]} = 0 — a triplet.`,
          vars: { i, l, r: rr, sum },
          visuals: [view('success'), chips('res', res.map((t) => `[${t.join(', ')}]`), { lines: res.map((t, k) => ({ text: `[${t.join(', ')}]`, state: k === res.length - 1 ? ('success' as CellState) : undefined })) })],
          tone: 'success',
        });
        l++;
        rr--;
        while (l < rr && nums[l] === nums[l - 1]) {
          r.step({
            at: 'while (l < r && nums[l] == nums[l - 1]) {',
            explain: `nums[${l}] repeats ${nums[l]} — skip it so the same triplet is not reported twice.`,
            vars: { l, r: rr },
            visuals: [
              arr(nums, {
                title: 'nums (sorted)',
                states: at(nums.length, [l], 'muted'),
                pointers: [
                  { name: 'i', index: i },
                  { name: 'l', index: l, tone: 3 },
                  { name: 'r', index: rr, tone: 2 },
                ],
              }),
              resViz(),
            ],
          });
          l++;
        }
      }
    }
  }

  r.step({
    at: 'return res;',
    explain: `All triplets found, each exactly once.`,
    visuals: [arr(nums, { title: 'nums (sorted)' }), resViz()],
    tone: 'success',
    result: `return [${res.map((t) => `[${t.join(', ')}]`).join(', ')}]`,
  });
}

/* ── Container With Most Water ────────────────────────────────────────────── */

function maxArea(r: Recorder, heights: number[]) {
  let maxSize = 0;
  let l = 0;
  let rr = heights.length - 1;

  const view = (size: number, best: boolean): Visual[] => [
    bars(heights, {
      title: 'heights',
      states: heights.map((_, i) => (i === l || i === rr ? ('active' as CellState) : i < l || i > rr ? ('muted' as CellState) : undefined)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
      overlays: [
        {
          index: l,
          span: rr - l + 1,
          from: 0,
          to: Math.min(heights[l], heights[rr]),
          tone: best ? 'area' : 'water',
          label: `${size}`,
        },
      ],
    }),
  ];

  r.step({
    at: 'int l = 0, r = heights.length - 1;',
    explain:
      'Start with the widest possible container. Any move inwards loses width, so it only pays off if the shorter wall is replaced.',
    vars: { l, r: rr, maxSize },
    visuals: view(0, false),
  });

  while (l < rr) {
    const size = Math.min(heights[l], heights[rr]) * (rr - l);
    const isBest = size > maxSize;
    maxSize = Math.max(maxSize, size);
    r.step({
      at: ['int size = Math.min(heights[l], heights[r]) * (r - l);', 'maxSize = Math.max(maxSize, size);'],
      explain: `min(${heights[l]}, ${heights[rr]}) × (${rr} − ${l}) = ${size}.${isBest ? ' New best.' : ` Best stays ${maxSize}.`}`,
      vars: { l, r: rr, size, maxSize },
      visuals: view(size, isBest),
      tone: isBest ? 'success' : 'neutral',
    });

    if (heights[l] < heights[rr]) {
      r.step({
        at: ['if (heights[l] < heights[r]) {', 'l++;'],
        explain: `The left wall (${heights[l]}) is the shorter one — it caps the area, so move l inwards for any chance of improvement.`,
        vars: { l, r: rr, maxSize },
        visuals: view(size, false),
      });
      l++;
    } else {
      r.step({
        at: ['} else {', 'r--;'],
        explain: `The right wall (${heights[rr]}) is the shorter (or equal) one — move r inwards.`,
        vars: { l, r: rr, maxSize },
        visuals: view(size, false),
      });
      rr--;
    }
  }

  r.step({
    at: 'return maxSize;',
    explain: `The pointers met; the largest container held ${maxSize}.`,
    vars: { maxSize },
    visuals: [bars(heights, { title: 'heights' })],
    tone: 'success',
    result: `return ${maxSize}`,
  });
}

/* ── Trapping Rain Water ──────────────────────────────────────────────────── */

function trap(r: Recorder, height: number[]) {
  let maxLeft = 0;
  let maxRight = 0;
  let l = 0;
  let res = 0;
  let rr = height.length - 1;
  const water = new Array(height.length).fill(0);

  const view = (active: number[], state: CellState = 'active'): Visual[] => [
    bars(height, {
      title: 'height',
      states: height.map((_, i) => (active.includes(i) ? state : i < l || i > rr ? ('visited' as CellState) : undefined)),
      pointers: [
        { name: 'l', index: l },
        { name: 'r', index: rr, tone: 2 },
      ],
      overlays: water
        .map((w, i) => ({ index: i, from: height[i], to: height[i] + w, tone: 'water' as const, label: w ? String(w) : undefined }))
        .filter((o) => o.to > o.from),
      note: `maxLeft = ${maxLeft}, maxRight = ${maxRight}`,
    }),
  ];

  r.step({
    at: ['int maxLeft = 0, maxRight = 0;', 'int l = 0, res = 0, r = height.length - 1;'],
    explain:
      'Water above a bar is bounded by the tallest bar on each side. Walking inwards from both ends lets us know the smaller of those two bounds without precomputing arrays.',
    vars: { l, r: rr, maxLeft, maxRight, res },
    visuals: view([]),
  });

  while (l < rr) {
    if (maxLeft > height[l] && maxRight > height[l]) {
      const add = Math.min(maxLeft, maxRight) - height[l];
      water[l] = add;
      res += add;
      r.step({
        at: ['if (maxLeft > height[l] && maxRight > height[l]) {', 'res += Math.min(maxLeft, maxRight) - height[l];'],
        explain: `Bar ${l} (height ${height[l]}) sits below both walls (${maxLeft} and ${maxRight}), so it holds min(${maxLeft}, ${maxRight}) − ${height[l]} = ${add} units.`,
        vars: { l, r: rr, maxLeft, maxRight, res },
        visuals: view([l], 'window'),
        tone: 'success',
      });
    } else if (maxLeft > height[rr] && maxRight > height[rr]) {
      const add = Math.min(maxLeft, maxRight) - height[rr];
      water[rr] = add;
      res += add;
      r.step({
        at: ['} else if (maxLeft > height[r] && maxRight > height[r]) {', 'res += Math.min(maxLeft, maxRight) - height[r];'],
        explain: `Bar ${rr} (height ${height[rr]}) sits below both walls, so it holds ${add} units.`,
        vars: { l, r: rr, maxLeft, maxRight, res },
        visuals: view([rr], 'window'),
        tone: 'success',
      });
    } else {
      r.step({
        at: 'if (maxLeft > height[l] && maxRight > height[l]) {',
        explain: `Neither bar ${l} nor bar ${rr} is below both walls yet — no water is added this round.`,
        vars: { l, r: rr, maxLeft, maxRight, res },
        visuals: view([l, rr], 'compare'),
      });
    }

    const prevL = maxLeft;
    const prevR = maxRight;
    maxLeft = Math.max(maxLeft, height[l]);
    maxRight = Math.max(maxRight, height[rr]);
    if (maxLeft !== prevL || maxRight !== prevR) {
      r.step({
        at: ['maxLeft = Math.max(maxLeft, height[l]);', 'maxRight = Math.max(maxRight, height[r]);'],
        explain: `Update the walls: maxLeft = ${maxLeft}, maxRight = ${maxRight}.`,
        vars: { l, r: rr, maxLeft, maxRight, res },
        visuals: view([l, rr], 'compare'),
      });
    }

    if (height[l] < height[rr]) {
      r.step({
        at: 'if (height[l] < height[r]) l++;',
        explain: `height[${l}] = ${height[l]} < height[${rr}] = ${height[rr]}, so the left side is the limiting one — advance l.`,
        vars: { l, r: rr, res },
        visuals: view([l]),
      });
      l++;
    } else {
      r.step({
        at: 'r--;',
        explain: `height[${rr}] = ${height[rr]} ≤ height[${l}] = ${height[l]}, so the right side limits — pull r inwards.`,
        vars: { l, r: rr, res },
        visuals: view([rr]),
      });
      rr--;
    }
  }

  r.step({
    at: 'return res;',
    explain: `Total trapped water: ${res} units.`,
    vars: { res },
    visuals: view([]),
    tone: 'success',
    result: `return ${res}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const twoPointerTracers: Record<string, Tracer> = {
  'easy/twopointers/ValidPalindrome': {
    examples: [
      { label: '"Was it a car or a cat I saw?"', input: 's = "Was it a car or a cat I saw?"', run: (r) => validPalindrome(r, 'Was it a car or a cat I saw?') },
      { label: '"tab a cat"', input: 's = "tab a cat"', run: (r) => validPalindrome(r, 'tab a cat') },
    ],
  },
  'easy/twopointers/ValidPalindromeII': {
    examples: [
      { label: 's = "abca"', input: 's = "abca"', run: (r) => validPalindromeII(r, 'abca') },
      { label: 's = "abc"', input: 's = "abc"', run: (r) => validPalindromeII(r, 'abc') },
      { label: 's = "aba"', input: 's = "aba"', run: (r) => validPalindromeII(r, 'aba') },
    ],
  },
  'easy/twopointers/MergeStringAlternately': {
    examples: [
      { label: 'equal lengths', input: 'word1 = "abc", word2 = "pqr"', run: (r) => mergeAlternately(r, 'abc', 'pqr') },
      { label: 'word2 longer', input: 'word1 = "ab", word2 = "pqrs"', run: (r) => mergeAlternately(r, 'ab', 'pqrs') },
    ],
  },
  'easy/twopointers/RemoveElement': {
    examples: [
      { label: 'nums = [3,2,2,3], val = 3', input: 'nums = [3, 2, 2, 3], val = 3', run: (r) => removeElement(r, [3, 2, 2, 3], 3) },
      { label: 'nums = [0,1,2,2,3,0,4,2], val = 2', input: 'nums = [0, 1, 2, 2, 3, 0, 4, 2], val = 2', run: (r) => removeElement(r, [0, 1, 2, 2, 3, 0, 4, 2], 2) },
    ],
  },
  'easy/twopointers/RotateArray': {
    examples: [
      { label: 'nums = [1,2,3,4,5,6,7], k = 3', input: 'nums = [1, 2, 3, 4, 5, 6, 7], k = 3', run: (r) => rotateArray(r, [1, 2, 3, 4, 5, 6, 7], 3) },
      { label: 'k larger than n', input: 'nums = [1, 2, 3, 4], k = 6', run: (r) => rotateArray(r, [1, 2, 3, 4], 6) },
    ],
  },
  'medium/twopointers/TwoSumII': {
    examples: [
      { label: 'numbers = [1,2,3,4], target = 3', input: 'numbers = [1, 2, 3, 4], target = 3', run: (r) => twoSumII(r, [1, 2, 3, 4], 3) },
      { label: 'numbers = [2,7,11,15], target = 26', input: 'numbers = [2, 7, 11, 15], target = 26', run: (r) => twoSumII(r, [2, 7, 11, 15], 26) },
    ],
  },
  'medium/twopointers/ThreeSum': {
    examples: [
      { label: 'nums = [-1,0,1,2,-1,-4]', input: 'nums = [-1, 0, 1, 2, -1, -4]', run: (r) => threeSum(r, [-1, 0, 1, 2, -1, -4]) },
      { label: 'nums = [0,0,0,0]', input: 'nums = [0, 0, 0, 0]', run: (r) => threeSum(r, [0, 0, 0, 0]) },
    ],
  },
  'medium/twopointers/ContainerWithMostWater': {
    examples: [
      { label: 'heights = [1,7,2,5,4,7,3,6]', input: 'heights = [1, 7, 2, 5, 4, 7, 3, 6]', run: (r) => maxArea(r, [1, 7, 2, 5, 4, 7, 3, 6]) },
      { label: 'heights = [2,2,2]', input: 'heights = [2, 2, 2]', run: (r) => maxArea(r, [2, 2, 2]) },
    ],
  },
  'hard/twopointers/TrappingRainWater': {
    examples: [
      { label: 'height = [0,2,0,3,1,0,1,3,2,1]', input: 'height = [0, 2, 0, 3, 1, 0, 1, 3, 2, 1]', run: (r) => trap(r, [0, 2, 0, 3, 1, 0, 1, 3, 2, 1]) },
      { label: 'height = [4,2,0,3,2,5]', input: 'height = [4, 2, 0, 3, 2, 5]', run: (r) => trap(r, [4, 2, 0, 3, 2, 5]) },
    ],
  },
};
