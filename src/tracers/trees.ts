import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, TreeNodeViz, TreeViz, Visual } from '../types';
import { arr, chips, frames, queue } from './helpers';

/* ── A mutable binary tree the tracers can walk and rewrite ───────────────── */

interface TNode {
  id: string;
  val: number;
  left: TNode | null;
  right: TNode | null;
}

/** Builds a tree from a LeetCode level-order array (`null` = missing child). */
function tbuild(values: (number | null)[], prefix = 't'): TNode | null {
  if (values.length === 0 || values[0] === null) return null;
  const nodes = values.map((v, i) => (v === null ? null : { id: `${prefix}${i}`, val: v, left: null, right: null } as TNode));
  let child = 1;
  for (const n of nodes) {
    if (!n) continue;
    if (child < nodes.length) n.left = nodes[child++] ?? null;
    if (child < nodes.length) n.right = nodes[child++] ?? null;
  }
  return nodes[0];
}

interface TreeOpts {
  states?: Record<string, CellState>;
  badges?: Record<string, string>;
  note?: string;
}

function tv(title: string, root: TNode | null, o: TreeOpts = {}): TreeViz {
  const convert = (n: TNode | null): TreeNodeViz | null =>
    n ? { id: n.id, value: n.val, state: o.states?.[n.id], badge: o.badges?.[n.id], left: convert(n.left), right: convert(n.right) } : null;
  return { kind: 'tree', title, root: convert(root), note: o.note };
}

/** Frame labels for the call stack visual. */
class CallStack {
  readonly labels: string[] = [];
  push(label: string) {
    this.labels.push(label);
  }
  pop() {
    this.labels.pop();
  }
  viz(title = 'call stack') {
    return frames(title, this.labels.slice().reverse());
  }
}

/* ── Maximum Depth of Binary Tree ─────────────────────────────────────────── */

function maxDepth(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const stack = new CallStack();
  const depths: Record<string, string> = {};

  const go = (n: TNode | null, path: string): number => {
    if (!n) {
      r.step({
        at: 'if (root == null) return 0;',
        explain: `${path} is null — an empty subtree has depth 0.`,
        visuals: [tv('tree', root, { badges: depths }), stack.viz()],
      });
      return 0;
    }
    stack.push(`maxDepth(${n.val})`);
    r.step({
      at: 'return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));',
      explain: `Enter node ${n.val}: its depth is 1 + the deeper of its two subtrees, so recurse left first.`,
      vars: { node: n.val, depth: stack.labels.length },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges: depths }), stack.viz()],
    });

    const l = go(n.left, `${n.val}.left`);
    const rg = go(n.right, `${n.val}.right`);
    const d = 1 + Math.max(l, rg);
    depths[n.id] = `↩${d}`;
    stack.pop();
    r.step({
      at: 'return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));',
      explain: `Node ${n.val}: left returned ${l}, right returned ${rg} → return 1 + max(${l}, ${rg}) = ${d}.`,
      vars: { node: n.val, left: l, right: rg, returns: d },
      visuals: [tv('tree', root, { states: { [n.id]: 'done' }, badges: depths }), stack.viz()],
      tone: 'success',
    });
    return d;
  };

  r.step({
    at: 'public int maxDepth(TreeNode root) {',
    explain: 'Depth-first recursion: each node asks both children how deep they are, then adds itself.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const answer = go(root, 'root');
  r.step({
    at: 'return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));',
    explain: `The root returned ${answer}, the depth of the whole tree.`,
    visuals: [tv('tree', root, { badges: depths })],
    tone: 'success',
    result: `return ${answer}`,
  });
}

/* ── Same Tree ────────────────────────────────────────────────────────────── */

function sameTree(r: Recorder, a: (number | null)[], b: (number | null)[]) {
  const p0 = tbuild(a, 'p');
  const q0 = tbuild(b, 'q');
  const stack = new CallStack();

  const view = (p: TNode | null, q: TNode | null, state: CellState): Visual[] => [
    tv('p', p0, { states: p ? { [p.id]: state } : {} }),
    tv('q', q0, { states: q ? { [q.id]: state } : {} }),
    stack.viz(),
  ];

  const go = (p: TNode | null, q: TNode | null): boolean => {
    stack.push(`isSameTree(${p ? p.val : 'null'}, ${q ? q.val : 'null'})`);
    if (!p && !q) {
      r.step({
        at: 'if (p == null && q == null) return true;',
        explain: 'Both sides are null — identical so far.',
        visuals: view(p, q, 'success'),
      });
      stack.pop();
      return true;
    }
    if (!p || !q) {
      r.step({
        at: 'if (p == null || q == null) return false;',
        explain: 'One side has a node where the other has null — the shapes differ.',
        visuals: view(p, q, 'error'),
        tone: 'error',
      });
      stack.pop();
      return false;
    }
    if (p.val !== q.val) {
      r.step({
        at: 'return p.val == q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);',
        explain: `${p.val} ≠ ${q.val} — the trees differ here, and && short-circuits so the children are never visited.`,
        vars: { 'p.val': p.val, 'q.val': q.val },
        visuals: view(p, q, 'error'),
        tone: 'error',
      });
      stack.pop();
      return false;
    }
    r.step({
      at: 'return p.val == q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);',
      explain: `${p.val} = ${q.val}; now compare the left children, then the right ones.`,
      vars: { 'p.val': p.val, 'q.val': q.val },
      visuals: view(p, q, 'active'),
    });
    const ok = go(p.left, q.left) && go(p.right, q.right);
    stack.pop();
    return ok;
  };

  const answer = go(p0, q0);
  r.step({
    at: answer ? 'if (p == null && q == null) return true;' : 'if (p == null || q == null) return false;',
    explain: answer ? 'Every node matched in value and position.' : 'A mismatch was found, so the answer is false.',
    visuals: [tv('p', p0), tv('q', q0)],
    tone: answer ? 'success' : 'error',
    result: `return ${answer}`,
  });
}

/* ── Invert Binary Tree ───────────────────────────────────────────────────── */

function invertTree(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const stack = new CallStack();

  const go = (n: TNode | null, label: string): TNode | null => {
    if (!n) {
      r.step({
        at: 'if (root == null) return null;',
        explain: `${label} is null — nothing to invert.`,
        visuals: [tv('tree', root), stack.viz()],
      });
      return null;
    }
    stack.push(`invertTree(${n.val})`);
    const tmp = n.left;
    n.left = n.right;
    n.right = tmp;
    r.step({
      at: ['TreeNode tmp = root.left;', 'root.left = root.right;', 'root.right = tmp;'],
      explain: `Swap the children of ${n.val}: ${tmp ? tmp.val : 'null'} and ${n.left ? n.left.val : 'null'} change places.`,
      vars: { node: n.val },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' } }), stack.viz()],
    });
    r.step({
      at: ['root.left = this.invertTree(root.left);', 'root.right = this.invertTree(root.right);'],
      explain: `Now invert both subtrees of ${n.val} recursively.`,
      visuals: [tv('tree', root, { states: { [n.id]: 'window' } }), stack.viz()],
    });
    go(n.left, `${n.val}.left`);
    go(n.right, `${n.val}.right`);
    stack.pop();
    r.step({
      at: 'return root;',
      explain: `The subtree rooted at ${n.val} is fully mirrored.`,
      visuals: [tv('tree', root, { states: { [n.id]: 'done' } }), stack.viz()],
    });
    return n;
  };

  r.step({
    at: 'public TreeNode invertTree(TreeNode root) {',
    explain: 'Mirror the tree by swapping every node’s children on the way down.',
    visuals: [tv('tree', root), stack.viz()],
  });
  go(root, 'root');
  r.step({
    at: 'return root;',
    explain: 'Every node’s children have been swapped.',
    visuals: [tv('inverted tree', root)],
    tone: 'success',
    result: 'return root',
  });
}

/* ── Balanced Binary Tree ─────────────────────────────────────────────────── */

function balancedTree(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const badges: Record<string, string> = {};
  const stack = new CallStack();

  const dfs = (n: TNode | null): [number, number] => {
    if (!n) {
      return [1, 0];
    }
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['int[] left = dfs(root.left);', 'int[] right = dfs(root.right);'],
      explain: `Ask both subtrees of ${n.val} for their [balanced, height] pair.`,
      vars: { node: n.val },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges }), stack.viz()],
    });
    const left = dfs(n.left);
    const right = dfs(n.right);
    const balanced = left[0] === 1 && right[0] === 1 && Math.abs(left[1] - right[1]) <= 1;
    const height = 1 + Math.max(left[1], right[1]);
    badges[n.id] = `${balanced ? '✓' : '✗'} h${height}`;
    stack.pop();
    r.step({
      at: ['boolean balanced = ((left[0] == 1) && (right[0] == 1)) && Math.abs(left[1] - right[1]) <= 1;', 'return new int[]{balanced ? 1 : 0, 1 + Math.max(left[1], right[1])};'],
      explain: `Node ${n.val}: subtree heights ${left[1]} and ${right[1]} differ by ${Math.abs(left[1] - right[1])} → ${balanced ? 'balanced' : 'NOT balanced'}. Height is ${height}.`,
      vars: { node: n.val, leftHeight: left[1], rightHeight: right[1], balanced },
      visuals: [tv('tree', root, { states: { [n.id]: balanced ? 'done' : 'error' }, badges }), stack.viz()],
      tone: balanced ? 'neutral' : 'error',
    });
    return [balanced ? 1 : 0, height];
  };

  r.step({
    at: 'private int[] dfs(TreeNode root) {',
    explain:
      'One post-order pass returns two facts per node: whether its subtree is balanced, and how tall it is. No shared mutable state is needed.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const res = dfs(root);
  r.step({
    at: 'return dfs(root)[0] == 1;',
    explain: res[0] === 1 ? 'Every node’s subtrees differ in height by at most 1.' : 'Some node had subtrees differing by more than 1.',
    visuals: [tv('tree', root, { badges })],
    tone: res[0] === 1 ? 'success' : 'error',
    result: `return ${res[0] === 1}`,
  });
}

/* ── Diameter of Binary Tree ──────────────────────────────────────────────── */

function diameter(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const badges: Record<string, string> = {};
  const stack = new CallStack();
  let best = 0;

  const dfs = (n: TNode | null): number => {
    if (!n) return 0;
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['int left = dfs(root.left, diameter);', 'int right = dfs(root.right, diameter);'],
      explain: `Measure both subtrees of ${n.val}.`,
      vars: { node: n.val, 'diameter[0]': best },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges }), stack.viz()],
    });
    const left = dfs(n.left);
    const right = dfs(n.right);
    const through = left + right;
    const improved = through > best;
    best = Math.max(best, through);
    const height = 1 + Math.max(left, right);
    badges[n.id] = `h${height}`;
    stack.pop();
    r.step({
      at: ['diameter[0] = Math.max(diameter[0], left + right);', 'return 1 + Math.max(left, right);'],
      explain: `A path through ${n.val} is ${left} + ${right} = ${through} edges.${improved ? ' That is the longest so far.' : ''} Upwards, ${n.val} can only offer one side, so it returns 1 + max(${left}, ${right}) = ${height}.`,
      vars: { node: n.val, left, right, 'diameter[0]': best, returns: height },
      visuals: [tv('tree', root, { states: { [n.id]: improved ? 'success' : 'done' }, badges }), stack.viz()],
      tone: improved ? 'success' : 'neutral',
    });
    return height;
  };

  r.step({
    at: 'int[] diameter = new int[1];',
    explain:
      'The diameter may not pass through the root, so a single mutable maximum is kept while the recursion reports heights upwards.',
    visuals: [tv('tree', root), stack.viz()],
  });
  dfs(root);
  r.step({
    at: 'return diameter[0];',
    explain: `The longest path between any two nodes has ${best} edges.`,
    vars: { 'diameter[0]': best },
    visuals: [tv('tree', root, { badges })],
    tone: 'success',
    result: `return ${best}`,
  });
}

/* ── Subtree of Another Tree ──────────────────────────────────────────────── */

function subtree(r: Recorder, a: (number | null)[], b: (number | null)[]) {
  const root = tbuild(a, 'r');
  const subRoot = tbuild(b, 's');

  const same = (p: TNode | null, q: TNode | null): boolean => {
    if (!p && !q) return true;
    if (!p || !q) return false;
    return p.val === q.val && same(p.left, q.left) && same(p.right, q.right);
  };

  const go = (n: TNode | null): boolean => {
    if (!n) {
      r.step({
        at: 'if (root == null) return false;',
        explain: 'Ran off the end of the tree without a match on this branch.',
        visuals: [tv('root', root), tv('subRoot', subRoot)],
      });
      return false;
    }
    const matches = same(n, subRoot);
    r.step({
      at: 'return isSameTree(root, subRoot) || isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);',
      explain: matches
        ? `The subtree rooted at ${n.val} is identical to subRoot.`
        : `The subtree rooted at ${n.val} differs from subRoot — try its children.`,
      vars: { node: n.val, isSameTree: matches },
      visuals: [
        tv('root', root, { states: { [n.id]: matches ? 'success' : 'compare' } }),
        tv('subRoot', subRoot, { states: subRoot ? { [subRoot.id]: matches ? 'success' : 'active' } : {} }),
      ],
      tone: matches ? 'success' : 'neutral',
    });
    if (matches) return true;
    return go(n.left) || go(n.right);
  };

  r.step({
    at: 'public boolean isSubtree(TreeNode root, TreeNode subRoot) {',
    explain: 'Try to match subRoot at every node of root — O(n · m) in the worst case, but simple and exact.',
    visuals: [tv('root', root), tv('subRoot', subRoot)],
  });
  const answer = go(root);
  r.step({
    at: 'return isSameTree(root, subRoot) || isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);',
    explain: answer ? 'A matching subtree was found.' : 'No node of root starts a copy of subRoot.',
    visuals: [tv('root', root), tv('subRoot', subRoot)],
    tone: answer ? 'success' : 'error',
    result: `return ${answer}`,
  });
}

/* ── Binary Tree Level Order Traversal ────────────────────────────────────── */

function levelOrder(r: Recorder, values: (number | null)[], rightSideOnly = false) {
  const root = tbuild(values);
  const q: TNode[] = [];
  const res: number[][] = [];
  const done: Record<string, CellState> = {};

  const resViz = (): Visual =>
    rightSideOnly
      ? arr(res.map((lvl) => lvl[lvl.length - 1]), { title: 'res  (rightmost node of each level)' })
      : chips('res', res.map((lvl) => `[${lvl.join(', ')}]`), { emptyHint: '[]' });

  if (root) q.push(root);
  r.step({
    at: 'if (root != null) queue.add(root);',
    explain: 'Breadth-first search with a queue: one loop iteration handles exactly one level.',
    visuals: [tv('tree', root, { states: root ? { [root.id]: 'active' } : {} }), queue('queue', q.map((n) => n.val)), resViz()],
  });

  while (q.length > 0) {
    const level: number[] = [];
    const queueSize = q.length;
    r.step({
      at: 'int queueSize = queue.size();',
      explain: `The queue holds exactly the ${queueSize} node(s) of this level — capture that size before adding children, otherwise levels bleed into each other.`,
      vars: { queueSize, level: `[${level.join(', ')}]` },
      visuals: [
        tv('tree', root, { states: { ...done, ...Object.fromEntries(q.map((n) => [n.id, 'window' as CellState])) } }),
        queue('queue', q.map((n) => n.val)),
        resViz(),
      ],
    });

    for (let i = 0; i < queueSize; i++) {
      const n = q.shift()!;
      level.push(n.val);
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
      done[n.id] = 'visited';
      r.step({
        at: ['TreeNode node = queue.poll();', 'level.add(node.val);', 'if (node.left != null) queue.add(node.left);'],
        explain: `Take ${n.val} off the queue and enqueue its ${[n.left, n.right].filter(Boolean).length} child(ren).`,
        vars: { node: n.val, level: `[${level.join(', ')}]`, queue: `[${q.map((x) => x.val).join(', ')}]` },
        visuals: [
          tv('tree', root, {
            states: { ...done, [n.id]: 'active', ...Object.fromEntries(q.map((x) => [x.id, 'window' as CellState])) },
          }),
          queue('queue', q.map((x) => x.val)),
          resViz(),
        ],
      });
    }

    res.push(level);
    r.step({
      at: rightSideOnly ? 'res.add(level.getLast());' : 'res.add(level);',
      explain: rightSideOnly
        ? `From the right, only the last node of this level is visible: ${level[level.length - 1]}.`
        : `Level ${res.length - 1} is complete: [${level.join(', ')}].`,
      vars: { level: `[${level.join(', ')}]` },
      visuals: [tv('tree', root, { states: done }), queue('queue', q.map((x) => x.val)), resViz()],
      tone: 'success',
    });
  }

  r.step({
    at: 'return res;',
    explain: 'The queue is empty, so every level has been visited.',
    visuals: [tv('tree', root), resViz()],
    tone: 'success',
    result: rightSideOnly
      ? `return [${res.map((lvl) => lvl[lvl.length - 1]).join(', ')}]`
      : `return [${res.map((lvl) => `[${lvl.join(', ')}]`).join(', ')}]`,
  });
}

/* ── Count Good Nodes ─────────────────────────────────────────────────────── */

function goodNodes(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const states: Record<string, CellState> = {};
  const stack = new CallStack();
  let count = 0;

  const dfs = (n: TNode | null, maxSoFar: number): number => {
    if (!n) return 0;
    stack.push(`dfs(${n.val}, max=${maxSoFar})`);
    const isGood = maxSoFar <= n.val;
    if (isGood) count++;
    states[n.id] = isGood ? 'success' : 'muted';
    r.step({
      at: ['int toAdd = maxSoFar <= root.val ? 1 : 0;', 'maxSoFar = Math.max(maxSoFar, root.val);'],
      explain: isGood
        ? `${n.val} is ≥ every value on the path from the root (max ${maxSoFar}) — a good node.`
        : `${n.val} is smaller than ${maxSoFar} seen earlier on this path, so it is not good.`,
      vars: { node: n.val, maxSoFar, good: isGood, total: count },
      visuals: [tv('tree', root, { states: { ...states, [n.id]: isGood ? 'success' : 'error' } }), stack.viz()],
      tone: isGood ? 'success' : 'neutral',
    });
    const next = Math.max(maxSoFar, n.val);
    const total = (isGood ? 1 : 0) + dfs(n.left, next) + dfs(n.right, next);
    stack.pop();
    return total;
  };

  r.step({
    at: 'return dfs(root, root.val);',
    explain: 'Carry the maximum seen on the path down the recursion; a node is "good" when nothing bigger blocks the view from the root.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const answer = dfs(root, root!.val);
  r.step({
    at: 'return toAdd + dfs(root.left, maxSoFar) + dfs(root.right, maxSoFar);',
    explain: `${answer} nodes are visible from the root.`,
    visuals: [tv('tree', root, { states })],
    tone: 'success',
    result: `return ${answer}`,
  });
}

/* ── Kth Smallest in a BST ────────────────────────────────────────────────── */

function kthSmallest(r: Recorder, values: (number | null)[], k: number) {
  const root = tbuild(values);
  const out: number[] = [];
  const states: Record<string, CellState> = {};
  const stack = new CallStack();

  const dfs = (n: TNode | null) => {
    if (!n) return;
    stack.push(`dfs(${n.val})`);
    r.step({
      at: 'dfs(root.left, list);',
      explain: `At ${n.val}: everything smaller lives in the left subtree, so go there first.`,
      vars: { node: n.val },
      visuals: [tv('BST', root, { states: { ...states, [n.id]: 'active' } }), arr(out, { title: 'list' }), stack.viz()],
    });
    dfs(n.left);
    out.push(n.val);
    states[n.id] = 'visited';
    r.step({
      at: 'list.add(root.val);',
      explain: `Left subtree done, so ${n.val} is the next value in sorted order — it is number ${out.length}.`,
      vars: { node: n.val, list: `[${out.join(', ')}]` },
      visuals: [
        tv('BST', root, { states: { ...states, [n.id]: out.length === k ? 'success' : 'done' } }),
        arr(out, { title: 'list', states: out.map((_, i) => (i === k - 1 ? ('success' as CellState) : undefined)) }),
        stack.viz(),
      ],
      tone: out.length === k ? 'success' : 'neutral',
    });
    dfs(n.right);
    stack.pop();
  };

  r.step({
    at: 'private void dfs(TreeNode root, List<Integer> list) {',
    explain: 'In-order traversal of a BST visits values in increasing order, so the k-th value visited is the answer.',
    vars: { k },
    visuals: [tv('BST', root), arr(out, { title: 'list' }), stack.viz()],
  });
  dfs(root);
  r.step({
    at: 'return list.get(k - 1);',
    explain: `k is 1-indexed, so the answer is list[${k - 1}] = ${out[k - 1]}.`,
    vars: { k, answer: out[k - 1] },
    visuals: [
      tv('BST', root),
      arr(out, { title: 'list', states: out.map((_, i) => (i === k - 1 ? ('success' as CellState) : undefined)) }),
    ],
    tone: 'success',
    result: `return ${out[k - 1]}`,
  });
}

/* ── Lowest Common Ancestor in a BST ──────────────────────────────────────── */

function lca(r: Recorder, values: (number | null)[], p: number, q: number) {
  const root = tbuild(values);
  // Which `return root;` actually produced the answer — line 16 (the split
  // case) or line 19 (one of the nodes is the ancestor itself).
  let answeredAt = 'return root;@1';

  const go = (n: TNode | null): number | null => {
    if (!n) return null;
    const split = (p < n.val && q > n.val) || (q < n.val && p > n.val);
    if (split) {
      r.step({
        at: 'if ((p.val < root.val && q.val > root.val) || (q.val < root.val && p.val > root.val)) {',
        explain: `${p} and ${q} sit on opposite sides of ${n.val}, so the paths to them split here — ${n.val} is the lowest common ancestor.`,
        vars: { 'root.val': n.val, p, q },
        visuals: [tv('BST', root, { states: { [n.id]: 'success' } })],
        tone: 'success',
      });
      answeredAt = 'return root;@1';
      return n.val;
    }
    if (p === n.val || q === n.val) {
      r.step({
        at: 'if (p.val == root.val || q.val == root.val) return root;',
        explain: `${n.val} is one of the two nodes, and a node is allowed to be its own ancestor.`,
        vars: { 'root.val': n.val, p, q },
        visuals: [tv('BST', root, { states: { [n.id]: 'success' } })],
        tone: 'success',
      });
      answeredAt = 'if (p.val == root.val || q.val == root.val) return root;';
      return n.val;
    }
    if (p < n.val) {
      r.step({
        at: 'if (p.val < root.val) return lowestCommonAncestor(root.left, p, q);',
        explain: `Both ${p} and ${q} are smaller than ${n.val}, so the ancestor must be in the left subtree.`,
        vars: { 'root.val': n.val, p, q },
        visuals: [tv('BST', root, { states: { [n.id]: 'active' } })],
      });
      return go(n.left);
    }
    r.step({
      at: 'return lowestCommonAncestor(root.right, p, q);',
      explain: `Both ${p} and ${q} are larger than ${n.val}, so go right.`,
      vars: { 'root.val': n.val, p, q },
      visuals: [tv('BST', root, { states: { [n.id]: 'active' } })],
    });
    return go(n.right);
  };

  r.step({
    at: 'public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {',
    explain: `The BST ordering means no backtracking is needed: comparing p = ${p} and q = ${q} with the current value picks the branch.`,
    vars: { p, q },
    visuals: [tv('BST', root)],
  });
  const answer = go(root);
  r.step({
    at: answeredAt,
    explain: `The lowest common ancestor of ${p} and ${q} is ${answer}.`,
    visuals: [tv('BST', root)],
    tone: 'success',
    result: `return node(${answer})`,
  });
}

/* ── Validate Binary Search Tree ──────────────────────────────────────────── */

function validateBST(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const badges: Record<string, string> = {};
  const stack = new CallStack();

  const dfs = (n: TNode | null): [number, number, number] => {
    if (!n) return [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1];
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['int[] left = dfs(root.left);', 'int[] right = dfs(root.right);'],
      explain: `At ${n.val}: ask each subtree for its [min, max, valid] summary.`,
      vars: { node: n.val },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges }), stack.viz()],
    });
    const left = dfs(n.left);
    const right = dfs(n.right);

    if (left[2] === 0 || right[2] === 0) {
      stack.pop();
      r.step({
        at: 'if (left[2] == 0 || right[2] == 0) return new int[]{ 0, 0, 0 };',
        explain: `A subtree of ${n.val} is already invalid, so the whole tree is.`,
        visuals: [tv('tree', root, { states: { [n.id]: 'error' }, badges }), stack.viz()],
        tone: 'error',
      });
      return [0, 0, 0];
    }

    const ok = left[1] < n.val && n.val < right[0];
    if (!ok) {
      badges[n.id] = '✗';
      stack.pop();
      r.step({
        at: 'if (!(left[1] < root.val && root.val < right[0])) {',
        explain: `The largest value on the left is ${left[1] === Number.MIN_SAFE_INTEGER ? '−∞' : left[1]} and the smallest on the right is ${right[0] === Number.MAX_SAFE_INTEGER ? '+∞' : right[0]}. ${n.val} does not sit strictly between them, so the BST property is broken.`,
        vars: { node: n.val, maxLeft: left[1], minRight: right[0] },
        visuals: [tv('tree', root, { states: { [n.id]: 'error' }, badges }), stack.viz()],
        tone: 'error',
      });
      return [0, 0, 0];
    }

    const min = Math.min(left[0], n.val);
    const max = Math.max(right[1], n.val);
    badges[n.id] = `${min === Number.MAX_SAFE_INTEGER ? n.val : min}…${max === Number.MIN_SAFE_INTEGER ? n.val : max}`;
    stack.pop();
    r.step({
      at: ['int min = Math.min(left[0], root.val);', 'int max = Math.max(right[1], root.val);'],
      explain: `${n.val} is greater than everything on its left and smaller than everything on its right. The subtree spans ${min}…${max}.`,
      vars: { node: n.val, min, max, valid: true },
      visuals: [tv('tree', root, { states: { [n.id]: 'done' }, badges }), stack.viz()],
      tone: 'success',
    });
    return [min, max, 1];
  };

  r.step({
    at: '/** Returns [ minRight, maxLeft, isValid ] */',
    explain:
      'Checking only parent-child pairs is not enough — a node must beat every value in its left subtree and lose to every value in its right one. So each call reports the range it covers.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const res = dfs(root);
  r.step({
    at: 'return res[2] == 1;',
    explain: res[2] === 1 ? 'Every node respects the BST ordering.' : 'The ordering is violated somewhere.',
    visuals: [tv('tree', root, { badges })],
    tone: res[2] === 1 ? 'success' : 'error',
    result: `return ${res[2] === 1}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const treeTracers: Record<string, Tracer> = {
  'easy/tree/MaximumDepthOfBinaryTree': {
    examples: [
      { label: '[3,9,20,null,null,15,7]', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => maxDepth(r, [3, 9, 20, null, null, 15, 7]) },
      { label: '[1,2]', input: 'root = [1, 2]', run: (r) => maxDepth(r, [1, 2]) },
    ],
  },
  'easy/tree/SameTree': {
    examples: [
      { label: 'identical', input: 'p = [1, 2, 3], q = [1, 2, 3]', run: (r) => sameTree(r, [1, 2, 3], [1, 2, 3]) },
      { label: 'different values', input: 'p = [1, 2, 3], q = [1, 3, 2]', run: (r) => sameTree(r, [1, 2, 3], [1, 3, 2]) },
      { label: 'different shapes', input: 'p = [1, 2], q = [1, null, 2]', run: (r) => sameTree(r, [1, 2], [1, null, 2]) },
    ],
  },
  'easy/tree/InvertBinaryTree': {
    examples: [
      { label: '[4,2,7,1,3,6,9]', input: 'root = [4, 2, 7, 1, 3, 6, 9]', run: (r) => invertTree(r, [4, 2, 7, 1, 3, 6, 9]) },
      { label: '[1,2,3]', input: 'root = [1, 2, 3]', run: (r) => invertTree(r, [1, 2, 3]) },
    ],
  },
  'easy/tree/BalancedBinaryTree': {
    examples: [
      { label: 'balanced', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => balancedTree(r, [3, 9, 20, null, null, 15, 7]) },
      { label: 'unbalanced', input: 'root = [1, 2, 2, 3, 3, null, null, 4, 4]', run: (r) => balancedTree(r, [1, 2, 2, 3, 3, null, null, 4, 4]) },
    ],
  },
  'easy/tree/DiameterOfBinaryTree': {
    examples: [
      { label: '[1,2,3,4,5]', input: 'root = [1, 2, 3, 4, 5]', run: (r) => diameter(r, [1, 2, 3, 4, 5]) },
      { label: 'diameter misses the root', input: 'root = [1, 2, null, 3, 4, null, null, 5, 6]', run: (r) => diameter(r, [1, 2, null, 3, 4, null, null, 5, 6]) },
    ],
  },
  'easy/tree/SubtreeOfAnotherTree': {
    examples: [
      { label: 'is a subtree', input: 'root = [3, 4, 5, 1, 2], subRoot = [4, 1, 2]', run: (r) => subtree(r, [3, 4, 5, 1, 2], [4, 1, 2]) },
      { label: 'not a subtree', input: 'root = [3, 4, 5, 1, 2], subRoot = [4, 1, 3]', run: (r) => subtree(r, [3, 4, 5, 1, 2], [4, 1, 3]) },
    ],
  },
  'medium/tree/BinaryTreeLevelOrderTraversal': {
    examples: [
      { label: '[3,9,20,null,null,15,7]', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => levelOrder(r, [3, 9, 20, null, null, 15, 7]) },
      { label: '[1,2,3,4,5,6,7]', input: 'root = [1, 2, 3, 4, 5, 6, 7]', run: (r) => levelOrder(r, [1, 2, 3, 4, 5, 6, 7]) },
    ],
  },
  'medium/tree/BinaryTreeRightSideView': {
    examples: [
      { label: '[1,2,3,null,5,null,4]', input: 'root = [1, 2, 3, null, 5, null, 4]', run: (r) => levelOrder(r, [1, 2, 3, null, 5, null, 4], true) },
      { label: '[1,2,3,4]', input: 'root = [1, 2, 3, 4]', run: (r) => levelOrder(r, [1, 2, 3, 4], true) },
    ],
  },
  'medium/tree/CountGoodNodesInBinaryTree': {
    examples: [
      { label: '[3,1,4,3,null,1,5]', input: 'root = [3, 1, 4, 3, null, 1, 5]', run: (r) => goodNodes(r, [3, 1, 4, 3, null, 1, 5]) },
      { label: '[3,3,null,4,2]', input: 'root = [3, 3, null, 4, 2]', run: (r) => goodNodes(r, [3, 3, null, 4, 2]) },
    ],
  },
  'medium/tree/KthSmallestIntegerInBST': {
    examples: [
      { label: 'k = 3', input: 'root = [5, 3, 6, 2, 4, null, null, 1], k = 3', run: (r) => kthSmallest(r, [5, 3, 6, 2, 4, null, null, 1], 3) },
      { label: 'k = 1', input: 'root = [3, 1, 4, null, 2], k = 1', run: (r) => kthSmallest(r, [3, 1, 4, null, 2], 1) },
    ],
  },
  'medium/tree/LowestCommonAncestorInBinarySearchTree': {
    examples: [
      { label: 'p = 2, q = 8', input: 'root = [6, 2, 8, 0, 4, 7, 9], p = 2, q = 8', run: (r) => lca(r, [6, 2, 8, 0, 4, 7, 9], 2, 8) },
      { label: 'p = 2, q = 4', input: 'root = [6, 2, 8, 0, 4, 7, 9], p = 2, q = 4', run: (r) => lca(r, [6, 2, 8, 0, 4, 7, 9], 2, 4) },
    ],
  },
  'medium/tree/ValidateBinarySearchTree': {
    examples: [
      { label: 'valid BST', input: 'root = [5, 3, 8, 1, 4, 7, 9]', run: (r) => validateBST(r, [5, 3, 8, 1, 4, 7, 9]) },
      { label: 'invalid (deep violation)', input: 'root = [5, 1, 6, null, null, 4, 7]', run: (r) => validateBST(r, [5, 1, 6, null, null, 4, 7]) },
    ],
  },
};
