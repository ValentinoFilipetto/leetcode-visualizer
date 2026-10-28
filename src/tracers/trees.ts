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
      at: ['root.left = invertTree(root.left);', 'root.right = invertTree(root.right);'],
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
      return [0, 1];
    }
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['int[] resLeft = dfs(root.left);', 'int[] resRight = dfs(root.right);'],
      explain: `Ask both subtrees of ${n.val} for their [height, isBalanced] pair — a null child answers [0, 1].`,
      vars: { node: n.val },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges }), stack.viz()],
    });
    const resLeft = dfs(n.left);
    const resRight = dfs(n.right);
    let isBalanced = 1;
    const childUnbalanced = resLeft[1] === 0 || resRight[1] === 0;
    if (childUnbalanced) isBalanced = 0;
    const diff = Math.abs(resLeft[0] - resRight[0]);
    if (diff > 1) isBalanced = 0;
    const heigth = 1 + Math.max(resLeft[0], resRight[0]);
    badges[n.id] = `h${heigth} ${isBalanced ? '✓' : '✗'}`;
    stack.pop();
    const why = childUnbalanced
      ? 'a subtree below is already unbalanced, so this one cannot be balanced either'
      : diff > 1
        ? 'the heights differ by more than 1'
        : 'both subtrees are balanced and their heights differ by at most 1';
    r.step({
      at: [
        'if (resLeft[1] == 0 || resRight[1] == 0) isBalanced = 0;',
        'if (Math.abs(resLeft[0] - resRight[0]) > 1) isBalanced = 0;',
        'int heigth = 1 + Math.max(resLeft[0], resRight[0]);',
        'return new int[] { heigth, isBalanced };',
      ],
      explain: `Node ${n.val}: subtree heights ${resLeft[0]} and ${resRight[0]} → ${isBalanced ? 'balanced' : 'NOT balanced'}, because ${why}. Its height is ${heigth}.`,
      vars: { node: n.val, 'resLeft[0]': resLeft[0], 'resRight[0]': resRight[0], isBalanced, heigth },
      visuals: [tv('tree', root, { states: { [n.id]: isBalanced ? 'done' : 'error' }, badges }), stack.viz()],
      tone: isBalanced ? 'neutral' : 'error',
    });
    return [heigth, isBalanced];
  };

  r.step({
    at: 'int[] res = dfs(root);',
    explain:
      'One post-order pass returns two facts per node: how tall its subtree is, and whether it is balanced. No shared mutable state is needed.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const res = dfs(root);
  r.step({
    at: 'return res[1] == 1;',
    explain: res[1] === 1 ? 'Every node’s subtrees differ in height by at most 1.' : 'Some node had subtrees differing by more than 1, and that verdict propagated up to the root.',
    vars: { 'res[0]': res[0], 'res[1]': res[1] },
    visuals: [tv('tree', root, { badges })],
    tone: res[1] === 1 ? 'success' : 'error',
    result: `return ${res[1] === 1}`,
  });
}

/* ── Diameter of Binary Tree ──────────────────────────────────────────────── */

function diameter(r: Recorder, values: (number | null)[]) {
  const root = tbuild(values);
  const badges: Record<string, string> = {};
  const stack = new CallStack();
  let currMax = 0;

  const dfs = (n: TNode): number => {
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['int maxDepthLeft = root.left == null ? 0 : 1 + dfs(root.left);', 'int maxDepthRight = root.right == null ? 0 : 1 + dfs(root.right);'],
      explain: `How many edges reach down from ${n.val} on each side? A missing child contributes 0; a present one contributes 1 edge plus however deep it goes.`,
      vars: { node: n.val, currMax },
      visuals: [tv('tree', root, { states: { [n.id]: 'active' }, badges }), stack.viz()],
    });
    const maxDepthLeft = n.left === null ? 0 : 1 + dfs(n.left);
    const maxDepthRight = n.right === null ? 0 : 1 + dfs(n.right);
    const through = maxDepthLeft + maxDepthRight;
    const improved = through > currMax;
    currMax = Math.max(currMax, through);
    const ret = Math.max(maxDepthLeft, maxDepthRight);
    badges[n.id] = `↓${ret}`;
    stack.pop();
    r.step({
      at: ['currMax = Math.max(currMax, maxDepthLeft + maxDepthRight);', 'return Math.max(maxDepthLeft, maxDepthRight);'],
      explain: `The longest path bending at ${n.val} is ${maxDepthLeft} + ${maxDepthRight} = ${through} edges.${improved ? ' That is the longest so far.' : ''} Upwards, a path can only continue through one side, so ${n.val} returns max(${maxDepthLeft}, ${maxDepthRight}) = ${ret}.`,
      vars: { node: n.val, maxDepthLeft, maxDepthRight, currMax, returns: ret },
      visuals: [tv('tree', root, { states: { [n.id]: improved ? 'success' : 'done' }, badges }), stack.viz()],
      tone: improved ? 'success' : 'neutral',
    });
    return ret;
  };

  r.step({
    at: 'int currMax = 0;',
    explain:
      'The diameter may not pass through the root, so a field keeps the best path seen anywhere while the recursion reports depths upwards.',
    visuals: [tv('tree', root), stack.viz()],
  });
  if (root) dfs(root);
  r.step({
    at: 'return currMax;',
    explain: `The longest path between any two nodes has ${currMax} edges.`,
    vars: { currMax },
    visuals: [tv('tree', root, { badges })],
    tone: 'success',
    result: `return ${currMax}`,
  });
}

/* ── Binary Tree Preorder / Inorder / Postorder Traversal ─────────────────── */

type DfsOrder = 'pre' | 'in' | 'post';

function traversal(r: Recorder, values: (number | null)[], order: DfsOrder) {
  const root = tbuild(values);
  const stack = new CallStack();
  const res: number[] = [];
  const done: Record<string, CellState> = {};
  const name = { pre: 'preorder', in: 'inorder', post: 'postorder' }[order];
  const why = {
    pre: 'a node is recorded before either of its subtrees',
    in: 'a node is recorded after everything on its left and before everything on its right',
    post: 'a node is recorded only once both of its subtrees are finished',
  }[order];

  const view = (cur?: TNode, state: CellState = 'active'): Visual[] => [
    tv('tree', root, { states: cur ? { ...done, [cur.id]: state } : { ...done } }),
    arr(res.slice(), { title: 'res' }),
    stack.viz(),
  ];

  const visit = (n: TNode) => {
    res.push(n.val);
    done[n.id] = 'done';
    r.step({
      at: 'res.add(root.val);',
      explain: `Record ${n.val} now — in ${name} order ${why}.`,
      vars: { node: n.val },
      visuals: view(n, 'success'),
      tone: 'success',
    });
  };

  const descend = (n: TNode, side: 'left' | 'right') => {
    const child = n[side];
    r.step({
      at: `dfs(root.${side});`,
      explain: child ? `Go down into ${n.val}'s ${side} child, ${child.val}.` : `${n.val} has no ${side} child — the call will return immediately.`,
      vars: { node: n.val },
      visuals: view(n),
    });
    dfs(child, `${n.val}.${side}`);
  };

  const dfs = (n: TNode | null, label: string) => {
    if (!n) {
      stack.push('dfs(null)');
      r.step({
        at: 'if (root == null) return;',
        explain: `${label} is null — nothing to record, return to the caller.`,
        visuals: view(),
      });
      stack.pop();
      return;
    }
    stack.push(`dfs(${n.val})`);
    if (order === 'pre') visit(n);
    descend(n, 'left');
    if (order === 'in') visit(n);
    descend(n, 'right');
    if (order === 'post') visit(n);
    stack.pop();
  };

  r.step({
    at: 'dfs(root);',
    explain: `A recursive DFS appends each value to res; where the add sits relative to the two recursive calls is all that makes it ${name}.`,
    visuals: view(),
  });
  dfs(root, 'root');
  r.step({
    at: 'return res;',
    explain: `Every node has been recorded exactly once, in ${name} order.`,
    visuals: view(),
    tone: 'success',
    result: `return [${res.join(', ')}]`,
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
    if (!n && subRoot) {
      r.step({
        at: 'if (root == null && subRoot != null) return false;',
        explain: 'Ran off the end of the tree on this branch — an empty tree cannot contain a non-empty subRoot.',
        visuals: [tv('root', root), tv('subRoot', subRoot)],
      });
      return false;
    }
    const matches = same(n, subRoot);
    if (matches) {
      r.step({
        at: 'if (isSameTree(root, subRoot)) return true;',
        explain: n ? `The subtree rooted at ${n.val} is identical to subRoot, so there is no need to look any deeper.` : 'Both trees are empty, and an empty tree trivially contains itself.',
        vars: { node: n ? n.val : 'null', isSameTree: true },
        visuals: [
          tv('root', root, { states: n ? { [n.id]: 'success' } : {} }),
          tv('subRoot', subRoot, { states: subRoot ? { [subRoot.id]: 'success' } : {} }),
        ],
        tone: 'success',
      });
      return true;
    }
    // isSameTree(null, non-null) is false, but that case already returned above, so n is non-null here.
    const node = n as TNode;
    r.step({
      at: ['if (isSameTree(root, subRoot)) return true;', 'return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);'],
      explain: `The subtree rooted at ${node.val} differs from subRoot — but a copy could still start lower down, so try its left child, then its right.`,
      vars: { node: node.val, isSameTree: false },
      visuals: [
        tv('root', root, { states: { [node.id]: 'compare' } }),
        tv('subRoot', subRoot, { states: subRoot ? { [subRoot.id]: 'active' } : {} }),
      ],
    });
    return go(node.left) || go(node.right);
  };

  r.step({
    at: 'public boolean isSubtree(TreeNode root, TreeNode subRoot) {',
    explain: 'Try to match subRoot at every node of root — O(n · m) in the worst case, but simple and exact.',
    visuals: [tv('root', root), tv('subRoot', subRoot)],
  });
  const answer = go(root);
  r.step({
    at: answer ? 'if (isSameTree(root, subRoot)) return true;' : 'return isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);',
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
  // Level order builds List<List<Integer>>; right side view a flat List<Integer>.
  const levels: number[][] = [];
  const view: number[] = [];
  const done: Record<string, CellState> = {};

  const resViz = (): Visual =>
    rightSideOnly
      ? arr(view, { title: 'res  (rightmost node of each level)' })
      : chips('res', levels.map((lvl) => `[${lvl.join(', ')}]`), { emptyHint: '[]' });
  const resText = () => (rightSideOnly ? `[${view.join(', ')}]` : `[${levels.map((lvl) => `[${lvl.join(', ')}]`).join(', ')}]`);

  if (!root) {
    r.step({
      at: 'if (root == null) return res;',
      explain: 'An empty tree has no levels.',
      visuals: [tv('tree', root), resViz()],
      tone: 'success',
      result: 'return []',
    });
    return;
  }

  q.push(root);
  r.step({
    at: 'queue.offer(root);',
    explain: 'Breadth-first search with a queue: one pass of the outer loop handles exactly one level.',
    visuals: [tv('tree', root, { states: { [root.id]: 'window' } }), queue('queue', q.map((n) => n.val)), resViz()],
  });

  while (q.length > 0) {
    const levelSize = q.length;
    if (!rightSideOnly) levels.push([]);
    r.step({
      at: rightSideOnly ? 'int levelSize = queue.size();' : ['int levelSize = queue.size();', 'res.add(new ArrayList<>());'],
      explain: `The queue holds exactly the ${levelSize} node(s) of this level — capture that size before adding children, otherwise levels bleed into each other.${rightSideOnly ? '' : ' Open an empty list for the level.'}`,
      vars: { levelSize },
      visuals: [
        tv('tree', root, { states: { ...done, ...Object.fromEntries(q.map((n) => [n.id, 'window' as CellState])) } }),
        queue('queue', q.map((n) => n.val)),
        resViz(),
      ],
    });

    for (let i = 0; i < levelSize; i++) {
      const n = q.shift()!;
      const last = i === levelSize - 1;
      if (rightSideOnly) {
        if (last) view.push(n.val);
      } else {
        levels[levels.length - 1].push(n.val);
      }
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
      done[n.id] = 'visited';
      const kids = [n.left, n.right].filter(Boolean).length;
      r.step({
        at: [
          'TreeNode node = queue.poll();',
          rightSideOnly ? 'if (i == levelSize - 1) res.add(node.val);' : 'res.get(res.size() - 1).add(node.val);',
          'if (node.left != null) queue.offer(node.left);',
          'if (node.right != null) queue.offer(node.right);',
        ],
        explain: rightSideOnly
          ? last
            ? `${n.val} is the last node of its level, so nothing hides it from the right — it goes into res. Enqueue its ${kids} child(ren).`
            : `${n.val} is not the last node of its level; a node further right hides it. Enqueue its ${kids} child(ren) anyway — they may be visible lower down.`
          : `Take ${n.val} off the queue, append it to the current level, and enqueue its ${kids} child(ren) for the next level.`,
        vars: { i, levelSize, node: n.val, queue: `[${q.map((x) => x.val).join(', ')}]` },
        visuals: [
          tv('tree', root, {
            states: {
              ...done,
              ...Object.fromEntries(q.map((x) => [x.id, 'window' as CellState])),
              [n.id]: rightSideOnly && last ? 'success' : 'active',
            },
          }),
          queue('queue', q.map((x) => x.val)),
          resViz(),
        ],
        tone: rightSideOnly && last ? 'success' : 'neutral',
      });
    }
  }

  r.step({
    at: 'return res;@2',
    explain: 'The queue is empty, so every level has been visited.',
    visuals: [tv('tree', root), resViz()],
    tone: 'success',
    result: `return ${resText()}`,
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
      at: 'dfs(root.left);',
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
    at: 'private void dfs(TreeNode root) {',
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
  // Which `return root;` actually produced the answer — the split case or the
  // one where p or q is the ancestor itself.
  let answeredAt = 'return root;@1';

  const go = (n: TNode | null): number | null => {
    if (!n) return null;
    const split = (p < n.val && q > n.val) || (q < n.val && p > n.val);
    if (split) {
      r.step({
        at: 'if ((p.val < root.val && q.val > root.val) || (q.val < root.val && p.val > root.val)) return root;',
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
  const states: Record<string, CellState> = {};
  const stack = new CallStack();
  const show = (x: number) => (x === -Infinity ? '−∞' : x === Infinity ? '+∞' : String(x));

  // Returns [max, min, isValid], like the Java long[] (null -> [MIN, MAX, 1]).
  const dfs = (n: TNode | null): [number, number, number] => {
    if (!n) return [-Infinity, Infinity, 1];
    stack.push(`dfs(${n.val})`);
    r.step({
      at: ['long[] left = dfs(root.left);', 'long[] right = dfs(root.right);'],
      explain: `At ${n.val}: ask each subtree for its [max, min, valid] summary before judging this node.`,
      vars: { node: n.val },
      visuals: [tv('tree', root, { states: { ...states, [n.id]: 'active' }, badges }), stack.viz()],
    });
    const left = dfs(n.left);
    const right = dfs(n.right);

    const ordered = left[0] < n.val && n.val < right[1];
    const isValid = ordered && left[2] === 1 && right[2] === 1 ? 1 : 0;
    const max = Math.max(n.val, Math.max(left[0], right[0]));
    const min = Math.min(n.val, Math.min(left[1], right[1]));
    badges[n.id] = `${min}…${max}${isValid ? '' : ' ✗'}`;
    states[n.id] = isValid ? 'done' : 'error';
    stack.pop();

    let explain: string;
    if (!ordered) {
      explain = `The largest value on the left is ${show(left[0])} and the smallest on the right is ${show(right[1])}. ${n.val} does not sit strictly between them, so the BST property is broken here.`;
    } else if (!isValid) {
      explain = `${n.val} sits between ${show(left[0])} and ${show(right[1])}, but a subtree below already reported invalid — that verdict propagates up.`;
    } else {
      explain = `${show(left[0])} < ${n.val} < ${show(right[1])} and both subtrees are valid. The subtree spans ${min}…${max}.`;
    }
    r.step({
      at: [
        'long isValid = (left[0] < root.val && root.val < right[1])',
        'long max = Math.max(root.val, Math.max(left[0], right[0]));',
        'long min = Math.min(root.val, Math.min(left[1], right[1]));',
      ],
      explain: `${explain} max/min look at both sides so the range is the true range of the subtree, even when it is out of order.`,
      vars: { node: n.val, maxLeft: show(left[0]), minRight: show(right[1]), isValid, max, min },
      visuals: [tv('tree', root, { states, badges }), stack.viz()],
      tone: isValid ? 'success' : 'error',
    });
    return [max, min, isValid];
  };

  r.step({
    at: 'public boolean isValidBST(TreeNode root) {',
    explain:
      'Checking only parent-child pairs is not enough — a node must beat every value in its left subtree and lose to every value in its right one. So each call reports the max and min of the subtree it covers.',
    visuals: [tv('tree', root), stack.viz()],
  });
  const res = dfs(root);
  r.step({
    at: 'return dfs(root)[2] == 1;',
    explain: res[2] === 1 ? 'Every node respects the BST ordering.' : 'The ordering is violated somewhere.',
    visuals: [tv('tree', root, { states, badges })],
    tone: res[2] === 1 ? 'success' : 'error',
    result: `return ${res[2] === 1}`,
  });
}

/* ── Insert into a Binary Search Tree ─────────────────────────────────────── */

function insertIntoBST(r: Recorder, values: (number | null)[], val: number) {
  let root = tbuild(values);
  const states: Record<string, CellState> = {};
  const stack = new CallStack();

  r.step({
    at: 'public TreeNode insertIntoBST(TreeNode root, int val) {',
    explain: `Walk down from the root comparing with ${val}: the BST ordering decides each turn, and the first missing child on that path is where ${val} belongs.`,
    vars: { val },
    visuals: [tv('BST', root), stack.viz()],
  });

  if (!root) {
    root = { id: 'new', val, left: null, right: null };
    r.step({
      at: 'if (root == null) return new TreeNode(val);',
      explain: `The tree is empty, so ${val} becomes the whole tree.`,
      vars: { val },
      visuals: [tv('BST', root, { states: { new: 'success' } })],
      tone: 'success',
      result: `return [${val}]`,
    });
    return;
  }

  const dfs = (n: TNode) => {
    stack.push(`dfs(${n.val})`);
    if (val < n.val) {
      if (n.left) {
        r.step({
          at: ['if (val < root.val) {', 'if (root.left != null) dfs(root.left, val);'],
          explain: `${val} < ${n.val}, so it belongs in the left subtree, which exists — keep descending.`,
          vars: { 'root.val': n.val, val },
          visuals: [tv('BST', root, { states: { ...states, [n.id]: 'active' } }), stack.viz()],
        });
        states[n.id] = 'visited';
        dfs(n.left);
      } else {
        n.left = { id: 'new', val, left: null, right: null };
        states[n.id] = 'visited';
        r.step({
          at: ['if (val < root.val) {', 'else root.left = new TreeNode(val);'],
          explain: `${val} < ${n.val} and ${n.val} has no left child — that empty spot is exactly where ${val} goes.`,
          vars: { 'root.val': n.val, val },
          visuals: [tv('BST', root, { states: { ...states, new: 'success' } }), stack.viz()],
          tone: 'success',
        });
      }
    }
    if (val > n.val) {
      if (n.right) {
        r.step({
          at: ['if (val > root.val) {', 'if (root.right != null) dfs(root.right, val);'],
          explain: `${val} > ${n.val}, so it belongs in the right subtree, which exists — keep descending.`,
          vars: { 'root.val': n.val, val },
          visuals: [tv('BST', root, { states: { ...states, [n.id]: 'active' } }), stack.viz()],
        });
        states[n.id] = 'visited';
        dfs(n.right);
      } else {
        n.right = { id: 'new', val, left: null, right: null };
        states[n.id] = 'visited';
        r.step({
          at: ['if (val > root.val) {', 'else root.right = new TreeNode(val);'],
          explain: `${val} > ${n.val} and ${n.val} has no right child — that empty spot is exactly where ${val} goes.`,
          vars: { 'root.val': n.val, val },
          visuals: [tv('BST', root, { states: { ...states, new: 'success' } }), stack.viz()],
          tone: 'success',
        });
      }
    }
    stack.pop();
  };

  dfs(root);
  r.step({
    at: 'return root;',
    explain: `The new node is a leaf, so nothing else moved and the root is unchanged.`,
    visuals: [tv('BST', root, { states: { new: 'success' } })],
    tone: 'success',
    result: 'return root',
  });
}

/* ── Delete Node in a Binary Search Tree ──────────────────────────────────── */

function deleteNode(r: Recorder, values: (number | null)[], key: number) {
  let root = tbuild(values);
  const states: Record<string, CellState> = {};
  const stack = new CallStack();
  const view = (extra: Record<string, CellState> = {}) => [tv('BST', root, { states: { ...states, ...extra } }), stack.viz()];

  const del = (n: TNode | null): TNode | null => {
    if (!n) {
      r.step({
        at: 'if (root == null) return null;',
        explain: `Fell off the tree: ${key} is not in it, so this subtree comes back unchanged (null).`,
        vars: { key },
        visuals: view(),
        tone: 'warn',
      });
      return null;
    }
    stack.push(`deleteNode(${n.val})`);

    if (key < n.val || key > n.val) {
      const goLeft = key < n.val;
      const line = goLeft
        ? 'if (key < root.val) root.left = deleteNode(root.left, key);@2'
        : 'else if (key > root.val) root.right = deleteNode(root.right, key);@2';
      r.step({
        at: line,
        explain: `${key} ${goLeft ? '<' : '>'} ${n.val}, so if ${key} exists it is in the ${goLeft ? 'left' : 'right'} subtree. Whatever that call returns becomes the new ${goLeft ? 'left' : 'right'} child.`,
        vars: { 'root.val': n.val, key },
        visuals: view({ [n.id]: 'active' }),
      });
      states[n.id] = 'visited';
      const child = del(goLeft ? n.left : n.right);
      if (goLeft) n.left = child;
      else n.right = child;
      stack.pop();
      r.step({
        at: [line, 'return root;'],
        explain: `Reattach the returned subtree (${child ? `rooted at ${child.val}` : 'null'}) as ${n.val}.${goLeft ? 'left' : 'right'}; ${n.val} itself stays, so return it to its parent.`,
        vars: { 'root.val': n.val, [`root.${goLeft ? 'left' : 'right'}`]: child ? child.val : 'null' },
        visuals: view({ [n.id]: 'done' }),
      });
      return n;
    }

    r.step({
      at: '// Node found',
      explain: `Found ${key}. Whatever this call returns replaces it in its parent.`,
      vars: { key },
      visuals: view({ [n.id]: 'error' }),
      tone: 'warn',
    });
    if (!n.left) {
      stack.pop();
      r.step({
        at: 'if (root.left == null) return root.right;',
        explain: `${n.val} has no left child, so its right subtree (${n.right ? `rooted at ${n.right.val}` : 'empty'}) simply takes its place.`,
        visuals: view({ [n.id]: 'error', ...(n.right ? { [n.right.id]: 'success' } : {}) }),
      });
      return n.right;
    }
    if (!n.right) {
      stack.pop();
      r.step({
        at: 'if (root.right == null) return root.left;',
        explain: `${n.val} has no right child, so its left subtree (rooted at ${n.left.val}) simply takes its place.`,
        visuals: view({ [n.id]: 'error', [n.left.id]: 'success' }),
      });
      return n.left;
    }

    const newRoot = n.right;
    let leftMost = newRoot;
    r.step({
      at: ['TreeNode newRoot = root.right;', 'TreeNode leftMost = newRoot;'],
      explain: `Two children: promote the right subtree (${newRoot.val}). Every value on the left is smaller than every value there, so the left subtree must hang off its smallest node.`,
      vars: { newRoot: newRoot.val, leftMost: leftMost.val },
      visuals: view({ [n.id]: 'error', [newRoot.id]: 'success', [leftMost.id]: 'active' }),
    });
    while (leftMost.left) {
      leftMost = leftMost.left;
      r.step({
        at: 'while (leftMost.left != null) leftMost = leftMost.left;',
        explain: `Keep going left to find the smallest value in the right subtree — now at ${leftMost.val}.`,
        vars: { newRoot: newRoot.val, leftMost: leftMost.val },
        visuals: view({ [n.id]: 'error', [newRoot.id]: 'success', [leftMost.id]: 'active' }),
      });
    }
    const leftSub = n.left;
    leftMost.left = leftSub;
    // Java leaves root.left dangling (the node is discarded anyway); clear it so
    // the moved subtree isn't drawn in two places.
    n.left = null;
    stack.pop();
    r.step({
      at: ['leftMost.left = root.left;', 'return newRoot;'],
      explain: `${leftMost.val} has no left child, and everything in ${leftSub.val}'s subtree is smaller than it, so attach it there. ${newRoot.val} now replaces ${n.val}.`,
      vars: { newRoot: newRoot.val, leftMost: leftMost.val },
      visuals: view({ [n.id]: 'error', [newRoot.id]: 'success', [leftSub.id]: 'active' }),
    });
    return newRoot;
  };

  r.step({
    at: 'public TreeNode deleteNode(TreeNode root, int key) {',
    explain: `Search for ${key} using the BST ordering. Each call returns the root of its (possibly rebuilt) subtree, so a parent never needs to know which side it came from.`,
    vars: { key },
    visuals: view(),
  });
  root = del(root);
  r.step({
    at: 'public TreeNode deleteNode(TreeNode root, int key) {',
    explain: `Done — the tree is still a valid BST without ${key}.`,
    visuals: [tv('BST', root)],
    tone: 'success',
    result: root ? `return node(${root.val})` : 'return null',
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const treeTracers: Record<string, Tracer> = {
  'easy/trees/MaximumDepthOfBinaryTree': {
    examples: [
      { label: '[3,9,20,null,null,15,7]', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => maxDepth(r, [3, 9, 20, null, null, 15, 7]) },
      { label: '[1,2]', input: 'root = [1, 2]', run: (r) => maxDepth(r, [1, 2]) },
    ],
  },
  'easy/trees/BinaryTreePreorderTraversal': {
    examples: [
      { label: '[1,2,3,4,5,null,6]', input: 'root = [1, 2, 3, 4, 5, null, 6]', run: (r) => traversal(r, [1, 2, 3, 4, 5, null, 6], 'pre') },
      { label: '[1,null,2,3]', input: 'root = [1, null, 2, 3]', run: (r) => traversal(r, [1, null, 2, 3], 'pre') },
    ],
  },
  'easy/trees/BinaryTreeInorderTraversal': {
    examples: [
      { label: '[1,2,3,4,5,null,6]', input: 'root = [1, 2, 3, 4, 5, null, 6]', run: (r) => traversal(r, [1, 2, 3, 4, 5, null, 6], 'in') },
      { label: '[1,null,2,3]', input: 'root = [1, null, 2, 3]', run: (r) => traversal(r, [1, null, 2, 3], 'in') },
    ],
  },
  'easy/trees/BinaryTreePostorderTraversal': {
    examples: [
      { label: '[1,2,3,4,5,null,6]', input: 'root = [1, 2, 3, 4, 5, null, 6]', run: (r) => traversal(r, [1, 2, 3, 4, 5, null, 6], 'post') },
      { label: '[1,null,2,3]', input: 'root = [1, null, 2, 3]', run: (r) => traversal(r, [1, null, 2, 3], 'post') },
    ],
  },
  'easy/trees/SameTree': {
    examples: [
      { label: 'identical', input: 'p = [1, 2, 3], q = [1, 2, 3]', run: (r) => sameTree(r, [1, 2, 3], [1, 2, 3]) },
      { label: 'different values', input: 'p = [1, 2, 3], q = [1, 3, 2]', run: (r) => sameTree(r, [1, 2, 3], [1, 3, 2]) },
      { label: 'different shapes', input: 'p = [1, 2], q = [1, null, 2]', run: (r) => sameTree(r, [1, 2], [1, null, 2]) },
    ],
  },
  'easy/trees/InvertBinaryTree': {
    examples: [
      { label: '[4,2,7,1,3,6,9]', input: 'root = [4, 2, 7, 1, 3, 6, 9]', run: (r) => invertTree(r, [4, 2, 7, 1, 3, 6, 9]) },
      { label: '[1,2,3]', input: 'root = [1, 2, 3]', run: (r) => invertTree(r, [1, 2, 3]) },
    ],
  },
  'easy/trees/BalancedBinaryTree': {
    examples: [
      { label: 'balanced', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => balancedTree(r, [3, 9, 20, null, null, 15, 7]) },
      { label: 'unbalanced', input: 'root = [1, 2, 2, 3, 3, null, null, 4, 4]', run: (r) => balancedTree(r, [1, 2, 2, 3, 3, null, null, 4, 4]) },
    ],
  },
  'easy/trees/DiameterOfBinaryTree': {
    examples: [
      { label: '[1,2,3,4,5]', input: 'root = [1, 2, 3, 4, 5]', run: (r) => diameter(r, [1, 2, 3, 4, 5]) },
      { label: 'diameter misses the root', input: 'root = [1, 2, null, 3, 4, null, null, 5, 6]', run: (r) => diameter(r, [1, 2, null, 3, 4, null, null, 5, 6]) },
    ],
  },
  'easy/trees/SubtreeOfAnotherTree': {
    examples: [
      { label: 'is a subtree', input: 'root = [3, 4, 5, 1, 2], subRoot = [4, 1, 2]', run: (r) => subtree(r, [3, 4, 5, 1, 2], [4, 1, 2]) },
      { label: 'not a subtree', input: 'root = [3, 4, 5, 1, 2], subRoot = [4, 1, 3]', run: (r) => subtree(r, [3, 4, 5, 1, 2], [4, 1, 3]) },
    ],
  },
  'medium/trees/BinaryTreeLevelOrderTraversal': {
    examples: [
      { label: '[3,9,20,null,null,15,7]', input: 'root = [3, 9, 20, null, null, 15, 7]', run: (r) => levelOrder(r, [3, 9, 20, null, null, 15, 7]) },
      { label: '[1,2,3,4,5,6,7]', input: 'root = [1, 2, 3, 4, 5, 6, 7]', run: (r) => levelOrder(r, [1, 2, 3, 4, 5, 6, 7]) },
    ],
  },
  'medium/trees/BinaryTreeRightSideView': {
    examples: [
      { label: '[1,2,3,null,5,null,4]', input: 'root = [1, 2, 3, null, 5, null, 4]', run: (r) => levelOrder(r, [1, 2, 3, null, 5, null, 4], true) },
      { label: '[1,2,3,4]', input: 'root = [1, 2, 3, 4]', run: (r) => levelOrder(r, [1, 2, 3, 4], true) },
    ],
  },
  'medium/trees/CountGoodNodesInBinaryTree': {
    examples: [
      { label: '[3,1,4,3,null,1,5]', input: 'root = [3, 1, 4, 3, null, 1, 5]', run: (r) => goodNodes(r, [3, 1, 4, 3, null, 1, 5]) },
      { label: '[3,3,null,4,2]', input: 'root = [3, 3, null, 4, 2]', run: (r) => goodNodes(r, [3, 3, null, 4, 2]) },
    ],
  },
  'medium/trees/KthSmallestIntegerInBST': {
    examples: [
      { label: 'k = 3', input: 'root = [5, 3, 6, 2, 4, null, null, 1], k = 3', run: (r) => kthSmallest(r, [5, 3, 6, 2, 4, null, null, 1], 3) },
      { label: 'k = 1', input: 'root = [3, 1, 4, null, 2], k = 1', run: (r) => kthSmallest(r, [3, 1, 4, null, 2], 1) },
    ],
  },
  'medium/trees/LowestCommonAncestorInBinarySearchTree': {
    examples: [
      { label: 'p = 2, q = 8', input: 'root = [6, 2, 8, 0, 4, 7, 9], p = 2, q = 8', run: (r) => lca(r, [6, 2, 8, 0, 4, 7, 9], 2, 8) },
      { label: 'p = 2, q = 4', input: 'root = [6, 2, 8, 0, 4, 7, 9], p = 2, q = 4', run: (r) => lca(r, [6, 2, 8, 0, 4, 7, 9], 2, 4) },
    ],
  },
  'medium/trees/ValidateBinarySearchTree': {
    examples: [
      { label: 'valid BST', input: 'root = [5, 3, 8, 1, 4, 7, 9]', run: (r) => validateBST(r, [5, 3, 8, 1, 4, 7, 9]) },
      { label: 'invalid (deep violation)', input: 'root = [5, 1, 6, null, null, 4, 7]', run: (r) => validateBST(r, [5, 1, 6, null, null, 4, 7]) },
      { label: 'invalid (needs both maxes)', input: 'root = [9, 6, 15, 3, 16, 10, 20]', run: (r) => validateBST(r, [9, 6, 15, 3, 16, 10, 20]) },
    ],
  },
  'medium/trees/InsertIntoABinarySearchTree': {
    examples: [
      { label: '[4,2,7,1,3], val = 5', input: 'root = [4, 2, 7, 1, 3], val = 5', run: (r) => insertIntoBST(r, [4, 2, 7, 1, 3], 5) },
      { label: '[40,20,60,10,30,50,70], val = 25', input: 'root = [40, 20, 60, 10, 30, 50, 70], val = 25', run: (r) => insertIntoBST(r, [40, 20, 60, 10, 30, 50, 70], 25) },
      { label: 'empty tree', input: 'root = [], val = 5', run: (r) => insertIntoBST(r, [], 5) },
    ],
  },
  'medium/trees/DeleteNodeInABinarySearchTree': {
    examples: [
      { label: 'key = 3 (two children)', input: 'root = [5, 3, 6, 2, 4, null, 7], key = 3', run: (r) => deleteNode(r, [5, 3, 6, 2, 4, null, 7], 3) },
      { label: 'delete the root', input: 'root = [5, 3, 8, 2, 4, 7, 9, null, null, null, null, 6], key = 5', run: (r) => deleteNode(r, [5, 3, 8, 2, 4, 7, 9, null, null, null, null, 6], 5) },
      { label: 'key = 6 (one child)', input: 'root = [5, 3, 6, 2, 4, null, 7], key = 6', run: (r) => deleteNode(r, [5, 3, 6, 2, 4, null, 7], 6) },
      { label: 'key not found', input: 'root = [5, 3, 6, 2, 4, null, 7], key = 0', run: (r) => deleteNode(r, [5, 3, 6, 2, 4, null, 7], 0) },
    ],
  },
};
