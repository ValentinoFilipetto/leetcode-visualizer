import type { Recorder } from '../trace/recorder';
import type { CellState, StackViz, Tracer, Visual } from '../types';
import { arr, bars, chars, list } from './helpers';

const stackViz = (title: string, items: (string | number)[], topState?: CellState, o: Partial<StackViz> = {}): StackViz => ({
  kind: 'stack',
  title,
  items: items.map((value, i) => ({ value, state: i === items.length - 1 ? topState : undefined })),
  emptyHint: 'empty stack',
  ...o,
});

/* ── Valid Parentheses ────────────────────────────────────────────────────── */

function validParentheses(r: Recorder, s: string) {
  const cs = chars(s);
  const st: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  const view = (i: number, state: CellState, topState?: CellState): Visual[] => [
    arr(cs, {
      title: 's',
      states: cs.map((_, k) => (k === i ? state : k < i ? ('visited' as CellState) : undefined)),
      pointers: i >= 0 && i < cs.length ? [{ name: 'c', index: i }] : [],
    }),
    stackViz('stack', st, topState),
  ];

  r.step({
    at: 'Stack<Character> stack = new Stack<>();',
    explain: 'Every closing bracket must match the most recently opened one — exactly what a stack models.',
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c === '(' || c === '[' || c === '{') {
      st.push(c);
      r.step({
        at: ["if (c == '(' || c == '[' || c == '{') {", 'stack.push(c);'],
        explain: `'${c}' opens a group — push it and wait for its partner.`,
        vars: { c, stack: list(st) },
        visuals: view(i, 'active', 'active'),
      });
      continue;
    }

    const expected = pairs[c];
    if (st.length > 0 && st[st.length - 1] === expected) {
      r.step({
        at: `c == '${c}' && stack.peek() == '${expected}'`,
        explain: `'${c}' closes the '${expected}' on top of the stack — pop it.`,
        vars: { c, 'stack.peek()': st[st.length - 1] },
        visuals: view(i, 'success', 'success'),
      });
      st.pop();
    } else {
      r.step({
        at: ['} else {', 'return false;'],
        explain:
          st.length === 0
            ? `'${c}' closes a group that was never opened.`
            : `'${c}' does not match the '${st[st.length - 1]}' on top of the stack.`,
        vars: { c, 'stack.peek()': st.length ? st[st.length - 1] : '—' },
        visuals: view(i, 'error', 'error'),
        tone: 'error',
        result: 'return false',
      });
      return;
    }
  }

  r.step({
    at: 'return stack.isEmpty();',
    explain: st.length === 0 ? 'Every bracket was closed in the right order.' : `${st.length} bracket(s) were never closed.`,
    vars: { stack: list(st) },
    visuals: view(-1, 'idle', 'error'),
    tone: st.length === 0 ? 'success' : 'error',
    result: `return ${st.length === 0}`,
  });
}

/* ── Min Stack ────────────────────────────────────────────────────────────── */

type StackOp = ['push', number] | ['pop'] | ['top'] | ['getMin'];

function minStack(r: Recorder, ops: StackOp[]) {
  const normal: number[] = [];
  const mins: number[] = [];
  const view = (a?: CellState, b?: CellState): Visual[] => [
    stackViz('normalStack', normal, a),
    stackViz('minStack  (running minimums)', mins, b),
  ];

  r.step({
    at: ['minStack = new Stack<>();', 'normalStack = new Stack<>();'],
    explain:
      'Two stacks: one holds the values, the other holds the minimum at each point in time. That makes getMin() O(1) instead of a scan.',
    visuals: view(),
  });

  for (const op of ops) {
    if (op[0] === 'push') {
      const val = op[1];
      normal.push(val);
      const isNewMin = mins.length === 0 || val <= mins[mins.length - 1];
      if (isNewMin) mins.push(val);
      r.step({
        at: ['normalStack.push(val);', 'if (minStack.isEmpty() || val <= minStack.peek()) {'],
        explain: isNewMin
          ? `push(${val}): ${val} is the new minimum, so it goes on both stacks. The "≤" matters — duplicates of the minimum must each be recorded, or popping one would lose the other.`
          : `push(${val}): the minimum is still ${mins[mins.length - 1]}, so minStack is untouched.`,
        vars: { val, min: mins[mins.length - 1] },
        visuals: view('active', isNewMin ? 'active' : undefined),
      });
    } else if (op[0] === 'pop') {
      const popped = normal.pop()!;
      const alsoMin = popped === mins[mins.length - 1];
      if (alsoMin) mins.pop();
      r.step({
        at: ['int poppedElement = normalStack.pop();', 'if (poppedElement == minStack.peek()) {'],
        explain: alsoMin
          ? `pop() removes ${popped}, which was also the current minimum — pop it off minStack too.`
          : `pop() removes ${popped}; the minimum ${mins[mins.length - 1]} is unaffected.`,
        vars: { poppedElement: popped, min: mins[mins.length - 1] },
        visuals: view('error', alsoMin ? 'error' : undefined),
      });
    } else if (op[0] === 'top') {
      r.step({
        at: 'return normalStack.peek();',
        explain: `top() peeks at the value stack.`,
        visuals: view('success'),
        tone: 'success',
        result: `top() = ${normal[normal.length - 1]}`,
      });
    } else {
      r.step({
        at: 'return minStack.peek();',
        explain: 'getMin() just peeks at the second stack — no scanning.',
        visuals: view(undefined, 'success'),
        tone: 'success',
        result: `getMin() = ${mins[mins.length - 1]}`,
      });
    }
  }
}

/* ── Evaluate Reverse Polish Notation ─────────────────────────────────────── */

function evalRPN(r: Recorder, tokens: string[]) {
  const st: number[] = [];
  const view = (i: number, state: CellState, topState?: CellState): Visual[] => [
    arr(tokens, {
      title: 'tokens',
      states: tokens.map((_, k) => (k === i ? state : k < i ? ('visited' as CellState) : undefined)),
      pointers: i >= 0 ? [{ name: 't', index: i }] : [],
    }),
    stackViz('stack', st, topState),
  ];

  r.step({
    at: 'Stack<Integer> stack = new Stack<>();',
    explain: 'In postfix notation an operator always applies to the two most recent values — so push numbers, and let operators pop.',
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      const num1 = st.pop()!;
      const num2 = st.pop()!;
      const value = t === '+' ? num2 + num1 : t === '-' ? num2 - num1 : t === '*' ? num2 * num1 : Math.trunc(num2 / num1);
      st.push(value);
      const snippet =
        t === '+'
          ? 'case "+" -> stack.push(stack.pop() + stack.pop());'
          : t === '*'
            ? 'case "*" -> stack.push(stack.pop() * stack.pop());'
            : t === '-'
              ? 'stack.push(num2 - num1);'
              : 'stack.push(num2 / num1); // Integer division required here by statement.';
      r.step({
        at: snippet,
        explain:
          t === '+' || t === '*'
            ? `"${t}" pops ${num1} and ${num2} and pushes ${num2} ${t} ${num1} = ${value}. Order does not matter for + and *.`
            : `"${t}" pops ${num1} first, then ${num2}, and pushes ${num2} ${t} ${num1} = ${value} — the order matters, hence the two named variables.`,
        vars: { t, num1, num2, pushed: value },
        visuals: view(i, 'active', 'success'),
      });
    } else {
      st.push(Number(t));
      r.step({
        at: 'default -> stack.push(Integer.parseInt(t));',
        explain: `"${t}" is a number — push it.`,
        vars: { t, stack: list(st) },
        visuals: view(i, 'active', 'active'),
      });
    }
  }

  r.step({
    at: 'return stack.pop();',
    explain: 'A well-formed expression leaves exactly one value on the stack: the answer.',
    visuals: view(-1, 'idle', 'success'),
    tone: 'success',
    result: `return ${st[st.length - 1]}`,
  });
}

/* ── Daily Temperatures ───────────────────────────────────────────────────── */

function dailyTemperatures(r: Recorder, temperatures: number[]) {
  const res = new Array(temperatures.length).fill(0);
  const st: [number, number][] = []; // [temp, index]

  const view = (i: number, state: CellState, topState?: CellState): Visual[] => [
    bars(temperatures, {
      title: 'temperatures',
      states: temperatures.map((_, k) =>
        k === i ? state : st.some(([, idx]) => idx === k) ? ('window' as CellState) : res[k] ? ('done' as CellState) : undefined,
      ),
      pointers: i >= 0 ? [{ name: 'i', index: i }] : [],
    }),
    stackViz(
      'stack  (indices still waiting for a warmer day)',
      st.map(([t, idx]) => `${t}°  @${idx}`),
      topState,
    ),
    arr(res, { title: 'res', states: res.map((v: number) => (v ? ('success' as CellState) : undefined)) }),
  ];

  r.step({
    at: ['int[] res = new int[temperatures.length];', 'Stack<int[]> stack = new Stack<>(); // pair: [temp, index]'],
    explain:
      'A monotonic stack: it holds days that are still waiting for a warmer day, always in decreasing temperature order.',
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < temperatures.length; i++) {
    const temp = temperatures[i];
    while (st.length > 0 && temp > st[st.length - 1][0]) {
      const [pTemp, pIdx] = st[st.length - 1];
      res[pIdx] = i - pIdx;
      r.step({
        at: ['while (!stack.isEmpty() && temp > stack.peek()[0]) {', 'res[pair[1]] = i - pair[1];'],
        explain: `Day ${i} (${temp}°) is warmer than day ${pIdx} (${pTemp}°), which has waited ${i - pIdx} day(s) — resolve it and pop.`,
        vars: { i, temp, 'pair[0]': pTemp, 'pair[1]': pIdx, wait: i - pIdx },
        visuals: view(i, 'active', 'success'),
        tone: 'success',
      });
      st.pop();
    }
    st.push([temp, i]);
    r.step({
      at: 'stack.push(new int[] { temp, i });',
      explain: `Day ${i} (${temp}°) now waits for its own warmer day.`,
      vars: { i, temp, stackSize: st.length },
      visuals: view(i, 'window', 'active'),
    });
  }

  r.step({
    at: 'return res;',
    explain: `Days still on the stack never saw a warmer day, so their answer stays 0.`,
    visuals: view(-1, 'idle'),
    tone: 'success',
    result: `return ${list(res)}`,
  });
}

/* ── Car Fleet ────────────────────────────────────────────────────────────── */

function carFleet(r: Recorder, target: number, position: number[], speed: number[]) {
  const pairs = position.map((p, i) => [p, speed[i]] as [number, number]).sort((a, b) => b[0] - a[0]);
  const st: number[] = [];

  const roadViz = (activeIdx: number, state: CellState): Visual =>
    arr(
      pairs.map(([p, s]) => `pos ${p}, ${s}×`),
      {
        title: 'cars, sorted by position descending (closest to target first)',
        indexed: false,
        labels: pairs.map(([p, s]) => `${((target - p) / s).toFixed(2)} h`),
        states: pairs.map((_, i) => (i === activeIdx ? state : i < activeIdx ? ('visited' as CellState) : undefined)),
      },
    );

  r.step({
    at: 'Arrays.sort(pairs, (a, b) -> Integer.compare(b[0], a[0]));',
    explain:
      'Sort by position descending: a car can only ever be blocked by a car ahead of it, so processing front-to-back lets us decide each car with one comparison.',
    vars: { target },
    visuals: [roadViz(-1, 'idle'), stackViz('stack  (arrival time of each fleet leader)', st)],
  });

  for (let i = 0; i < pairs.length; i++) {
    const [p, s] = pairs[i];
    const time = (target - p) / s;
    const isNewFleet = st.length === 0 || time > st[st.length - 1];
    if (isNewFleet) st.push(time);
    r.step({
      at: ['double timeToArrive = (double)(target - pair[0]) / pair[1];', 'if (stack.isEmpty() || timeToArrive > stack.peek()) {'],
      explain: isNewFleet
        ? `The car at ${p} needs ${time.toFixed(2)} h — slower than the fleet ahead, so it can never catch up and starts a new fleet.`
        : `The car at ${p} needs only ${time.toFixed(2)} h, so it catches the fleet ahead (${st[st.length - 1].toFixed(2)} h) and merges into it — nothing is pushed.`,
      vars: { position: p, speed: s, timeToArrive: time.toFixed(2), fleets: st.length },
      visuals: [
        roadViz(i, isNewFleet ? 'active' : 'muted'),
        stackViz(
          'stack  (arrival time of each fleet leader)',
          st.map((t) => t.toFixed(2)),
          isNewFleet ? 'active' : undefined,
        ),
      ],
      tone: isNewFleet ? 'success' : 'neutral',
    });
  }

  r.step({
    at: 'return stack.size();',
    explain: `Each value left on the stack is one fleet arriving at its own time.`,
    visuals: [roadViz(-1, 'idle'), stackViz('stack', st.map((t) => t.toFixed(2)))],
    tone: 'success',
    result: `return ${st.length}`,
  });
}

/* ── Largest Rectangle in Histogram ───────────────────────────────────────── */

function largestRectangle(r: Recorder, heights: number[]) {
  const n = heights.length;
  const left = new Array(n).fill(-1);
  const right = new Array(n).fill(n);
  const st: number[] = [];

  const view = (i: number, state: CellState, showLeft: boolean, showRight: boolean): Visual[] => [
    bars(heights, {
      title: 'heights',
      states: heights.map((_, k) => (k === i ? state : st.includes(k) ? ('window' as CellState) : undefined)),
      pointers: i >= 0 ? [{ name: 'i', index: i }] : [],
    }),
    stackViz(
      'stack  (indices of bars shorter than everything popped so far)',
      st.map((idx) => `${heights[idx]} @${idx}`),
    ),
    ...(showLeft ? [arr(left, { title: 'left[] — first shorter bar to the left (exclusive)' })] : []),
    ...(showRight ? [arr(right, { title: 'right[] — first shorter bar to the right (exclusive)' })] : []),
  ];

  r.step({
    at: ['int[] left = new int[n];', 'int[] right = new int[n];'],
    explain:
      'A bar of height h can extend sideways until it meets a shorter bar. Two monotonic-stack passes find those boundaries for every bar in O(n).',
    visuals: view(-1, 'idle', false, false),
  });

  for (let i = 0; i < n; i++) {
    left[i] = -1;
    while (st.length > 0 && heights[st[st.length - 1]] >= heights[i]) {
      const popped = st.pop()!;
      r.step({
        at: ['while (!stack.isEmpty() && heights[stack.peek()] >= heights[i]) {@1', 'stack.pop();@1'],
        explain: `Bar ${popped} (height ${heights[popped]}) is at least as tall as bar ${i} (height ${heights[i]}), so it cannot be bar ${i}'s left boundary — pop it.`,
        vars: { i, popped },
        visuals: view(i, 'active', true, false),
      });
    }
    if (st.length > 0) left[i] = st[st.length - 1];
    st.push(i);
    r.step({
      at: ['if (!stack.isEmpty()) {@1', 'left[i] = stack.peek();', 'stack.push(i);@1'],
      explain:
        left[i] === -1
          ? `Nothing shorter to the left of bar ${i}, so it can extend to the very start: left[${i}] = −1.`
          : `The nearest shorter bar to the left of bar ${i} is index ${left[i]} (height ${heights[left[i]]}).`,
      vars: { i, 'left[i]': left[i] },
      visuals: view(i, 'done', true, false),
    });
  }

  st.length = 0;
  r.step({
    at: 'stack.clear();',
    explain: 'Now the mirror image: the same scan from the right gives every bar its right boundary.',
    visuals: view(-1, 'idle', true, true),
  });

  for (let i = n - 1; i >= 0; i--) {
    right[i] = n;
    while (st.length > 0 && heights[st[st.length - 1]] >= heights[i]) {
      const popped = st.pop()!;
      r.step({
        at: ['while (!stack.isEmpty() && heights[stack.peek()] >= heights[i]) {@2', 'stack.pop();@2'],
        explain: `Bar ${popped} is at least as tall as bar ${i} — pop it, it cannot bound bar ${i}.`,
        vars: { i, popped },
        visuals: view(i, 'active', true, true),
      });
    }
    if (st.length > 0) right[i] = st[st.length - 1];
    st.push(i);
    r.step({
      at: ['right[i] = stack.peek();', 'stack.push(i);@2'],
      explain:
        right[i] === n
          ? `Nothing shorter to the right of bar ${i}, so right[${i}] = ${n} (past the end).`
          : `The nearest shorter bar to the right of bar ${i} is index ${right[i]}.`,
      vars: { i, 'right[i]': right[i] },
      visuals: view(i, 'done', true, true),
    });
  }

  let largest = 0;
  let bestIndex = 0;
  for (let i = 0; i < n; i++) {
    const width = right[i] - left[i] - 1;
    const area = heights[i] * width;
    if (area > largest) {
      largest = area;
      bestIndex = i;
    }
    r.step({
      at: 'largestArea = Math.max(largestArea, heights[i] * (right[i] - left[i] - 1));',
      explain: `Bar ${i} (height ${heights[i]}) spans indices ${left[i] + 1}…${right[i] - 1}: width ${width}, area ${area}.${area === largest ? ' Best so far.' : ''}`,
      vars: { i, 'left[i]': left[i], 'right[i]': right[i], width, area, largestArea: largest },
      visuals: [
        bars(heights, {
          title: 'heights',
          states: heights.map((_, k) => (k === i ? ('active' as CellState) : k > left[i] && k < right[i] ? ('window' as CellState) : undefined)),
          overlays: [{ index: left[i] + 1, span: width, from: 0, to: heights[i], tone: 'area', label: `${area}` }],
        }),
      ],
      tone: area === largest ? 'success' : 'neutral',
    });
  }

  r.step({
    at: 'return largestArea;',
    explain: `The largest rectangle rests on bar ${bestIndex} and covers ${largest} units of area.`,
    vars: { largestArea: largest },
    visuals: [
      bars(heights, {
        title: 'heights',
        states: heights.map((_, k) => (k > left[bestIndex] && k < right[bestIndex] ? ('success' as CellState) : undefined)),
        overlays: [
          {
            index: left[bestIndex] + 1,
            span: right[bestIndex] - left[bestIndex] - 1,
            from: 0,
            to: heights[bestIndex],
            tone: 'area',
            label: `${largest}`,
          },
        ],
      }),
    ],
    tone: 'success',
    result: `return ${largest}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const stackTracers: Record<string, Tracer> = {
  'easy/stack/ValidParentheses': {
    examples: [
      { label: 's = "([{}])"', input: 's = "([{}])"', run: (r) => validParentheses(r, '([{}])') },
      { label: 's = "[(])"', input: 's = "[(])"', run: (r) => validParentheses(r, '[(])') },
      { label: 's = "(("', input: 's = "(("', run: (r) => validParentheses(r, '((') },
    ],
  },
  'medium/stack/MinStack': {
    examples: [
      {
        label: 'push 3, 2, 2, getMin, pop, getMin',
        input: 'push(3), push(2), push(2), getMin(), pop(), getMin(), top()',
        run: (r) =>
          minStack(r, [['push', 3], ['push', 2], ['push', 2], ['getMin'], ['pop'], ['getMin'], ['top']]),
      },
    ],
  },
  'medium/stack/EvaluateReversePolishNotation': {
    examples: [
      { label: '["1","2","+","3","*"]', input: 'tokens = ["1", "2", "+", "3", "*"]', run: (r) => evalRPN(r, ['1', '2', '+', '3', '*']) },
      { label: 'with division', input: 'tokens = ["4", "13", "5", "/", "+"]', run: (r) => evalRPN(r, ['4', '13', '5', '/', '+']) },
    ],
  },
  'medium/stack/DailyTemperatures': {
    examples: [
      { label: '[30,38,30,36,35,40,28]', input: 'temperatures = [30, 38, 30, 36, 35, 40, 28]', run: (r) => dailyTemperatures(r, [30, 38, 30, 36, 35, 40, 28]) },
      { label: '[73,74,75,71,69,72,76,73]', input: 'temperatures = [73, 74, 75, 71, 69, 72, 76, 73]', run: (r) => dailyTemperatures(r, [73, 74, 75, 71, 69, 72, 76, 73]) },
    ],
  },
  'medium/stack/CarFleet': {
    examples: [
      {
        label: 'target = 12',
        input: 'target = 12, position = [10, 8, 0, 5, 3], speed = [2, 4, 1, 1, 3]',
        run: (r) => carFleet(r, 12, [10, 8, 0, 5, 3], [2, 4, 1, 1, 3]),
      },
      { label: 'target = 10', input: 'target = 10, position = [4, 1, 0, 7], speed = [2, 2, 1, 1]', run: (r) => carFleet(r, 10, [4, 1, 0, 7], [2, 2, 1, 1]) },
    ],
  },
  'hard/stack/LargestRectangleInHistogram': {
    examples: [
      { label: 'heights = [2,1,5,6,2,3]', input: 'heights = [2, 1, 5, 6, 2, 3]', run: (r) => largestRectangle(r, [2, 1, 5, 6, 2, 3]) },
      { label: 'heights = [7,1,7,2,2,4]', input: 'heights = [7, 1, 7, 2, 2, 4]', run: (r) => largestRectangle(r, [7, 1, 7, 2, 2, 4]) },
    ],
  },
};
