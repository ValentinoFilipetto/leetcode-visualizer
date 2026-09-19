import type { Recorder } from '../trace/recorder';
import type { CellState, ListViz, Tracer, Visual } from '../types';
import { mapOf } from './helpers';

/* ── A tiny linked-list model the tracers can mutate like the Java code ───── */

interface LNode {
  id: string;
  val: number | string;
  next: LNode | null;
  random?: LNode | null;
}

let uid = 0;
function node(val: number | string, prefix = 'n'): LNode {
  return { id: `${prefix}${uid++}`, val, next: null };
}

function build(values: (number | string)[], prefix = 'n'): LNode | null {
  let head: LNode | null = null;
  let tail: LNode | null = null;
  for (const v of values) {
    const n = node(v, prefix);
    if (!tail) {
      head = n;
      tail = n;
    } else {
      tail.next = n;
      tail = n;
    }
  }
  return head;
}

/** Walks a chain, stopping at a repeat so cyclic lists stay renderable. */
function walk(head: LNode | null, limit = 40): { nodes: LNode[]; cycleTo: string | null } {
  const nodes: LNode[] = [];
  const seen = new Set<string>();
  let cur = head;
  while (cur && nodes.length < limit) {
    if (seen.has(cur.id)) return { nodes, cycleTo: cur.id };
    seen.add(cur.id);
    nodes.push(cur);
    cur = cur.next;
  }
  return { nodes, cycleTo: null };
}

interface ListOpts {
  states?: Record<string, CellState>;
  pointers?: { name: string; node: LNode | null; tone?: 1 | 2 | 3 | 4 }[];
  labels?: Record<string, string>;
  extraEdges?: ListViz['extraEdges'];
  note?: string;
}

function lv(title: string, head: LNode | null, o: ListOpts = {}): ListViz {
  const { nodes, cycleTo } = walk(head);
  const ids = new Set(nodes.map((n) => n.id));
  return {
    kind: 'list',
    title,
    nodes: nodes.map((n) => ({ id: n.id, value: n.val, state: o.states?.[n.id], label: o.labels?.[n.id] })),
    pointers: (o.pointers ?? [])
      .filter((p) => p.node === null || ids.has(p.node.id))
      .map((p) => ({ name: p.name, nodeId: p.node ? p.node.id : null, tone: p.tone })),
    extraEdges: o.extraEdges?.filter((e) => ids.has(e.from) && ids.has(e.to)),
    cycleTo: cycleTo ?? undefined,
    note: o.note,
  };
}

/* ── Reverse Linked List ──────────────────────────────────────────────────── */

function reverseList(r: Recorder, values: number[]) {
  const head = build(values);
  let prev: LNode | null = null;
  let curr: LNode | null = head;

  const view = (tmp: LNode | null, activeId?: string): Visual[] => [
    lv('reversed so far  (prev)', prev, {
      states: prev ? { [prev.id]: 'done' } : {},
      pointers: [{ name: 'prev', node: prev, tone: 3 }],
    }),
    lv('still to process  (curr)', curr, {
      states: activeId ? { [activeId]: 'active' } : {},
      pointers: [
        { name: 'curr', node: curr },
        ...(tmp ? [{ name: 'tmp', node: tmp, tone: 2 as const }] : []),
      ],
    }),
  ];

  r.step({
    at: ['ListNode prev = null;', 'ListNode curr = head;'],
    explain: 'Walk the list once, flipping each next pointer backwards. prev is the part already reversed.',
    vars: { prev: 'null', curr: curr ? curr.val : 'null' },
    visuals: view(null),
  });

  while (curr) {
    const tmp: LNode | null = curr.next;
    r.step({
      at: 'ListNode tmp = curr.next;',
      explain: `Save curr.next (${tmp ? tmp.val : 'null'}) before overwriting it — otherwise the rest of the list becomes unreachable.`,
      vars: { prev: prev ? prev.val : 'null', curr: curr.val, tmp: tmp ? tmp.val : 'null' },
      visuals: view(tmp, curr.id),
    });

    curr.next = prev;
    prev = curr;
    curr = tmp;
    r.step({
      at: ['curr.next = prev;', 'prev = curr;', 'curr = tmp;'],
      explain: `Point that node at prev, then slide prev and curr one step along.`,
      vars: { prev: prev ? prev.val : 'null', curr: curr ? (curr as LNode).val : 'null' },
      visuals: view(null, prev.id),
    });
  }

  r.step({
    at: 'return prev;',
    explain: 'curr fell off the end, so prev is the head of the fully reversed list.',
    visuals: [lv('reversed list', prev, { states: Object.fromEntries(walk(prev).nodes.map((n) => [n.id, 'success' as CellState])) })],
    tone: 'success',
    result: `return ${walk(prev).nodes.map((n) => n.val).join(' → ')}`,
  });
}

/* ── Merge Two Sorted Lists ───────────────────────────────────────────────── */

function mergeTwoLists(r: Recorder, a: number[], b: number[]) {
  let list1 = build(a, 'a');
  let list2 = build(b, 'b');
  const dummy = node(0, 'd');
  let merged = dummy;

  const view = (state?: 'l1' | 'l2'): Visual[] => [
    lv('list1', list1, {
      states: list1 ? { [list1.id]: state === 'l1' ? 'success' : 'active' } : {},
      pointers: [{ name: 'list1', node: list1 }],
    }),
    lv('list2', list2, {
      states: list2 ? { [list2.id]: state === 'l2' ? 'success' : 'compare' } : {},
      pointers: [{ name: 'list2', node: list2, tone: 2 }],
    }),
    lv('dummy → merged list', dummy, {
      states: { [dummy.id]: 'muted', [merged.id]: 'done' },
      pointers: [{ name: 'mergedList', node: merged, tone: 3 }],
      labels: { [dummy.id]: 'dummy' },
    }),
  ];

  r.step({
    at: ['ListNode dummyNode = new ListNode(0);', 'ListNode mergedList = dummyNode;'],
    explain: 'A dummy head removes the "is this the first node?" special case — the answer is simply dummy.next at the end.',
    visuals: view(),
  });

  while (list1 && list2) {
    if (list1.val < list2.val) {
      r.step({
        at: ['if (list1.val < list2.val) {', 'mergedList.next = list1;@1', 'list1 = list1.next;'],
        explain: `${list1.val} < ${list2.val}, so splice the list1 node onto the merged list.`,
        vars: { 'list1.val': list1.val, 'list2.val': list2.val },
        visuals: view('l1'),
      });
      merged.next = list1;
      list1 = list1.next;
    } else {
      r.step({
        at: ['} else {', 'mergedList.next = list2;@1', 'list2 = list2.next;'],
        explain: `${list2.val} ≤ ${list1.val}, so take the list2 node instead.`,
        vars: { 'list1.val': list1.val, 'list2.val': list2.val },
        visuals: view('l2'),
      });
      merged.next = list2;
      list2 = list2.next;
    }
    merged = merged.next!;
  }

  if (list1) {
    merged.next = list1;
    r.step({
      at: ['if (list1 != null) {', 'mergedList.next = list1;@2'],
      explain: 'list2 ran out. Everything left in list1 is already sorted and larger, so append it in one link.',
      visuals: view(),
    });
  } else if (list2) {
    merged.next = list2;
    r.step({
      at: ['} else if (list2 != null) {', 'mergedList.next = list2;@2'],
      explain: 'list1 ran out, so append the remainder of list2 in one link.',
      visuals: view(),
    });
  }

  r.step({
    at: 'return dummyNode.next;',
    explain: 'Skip the dummy and return the real head.',
    visuals: [lv('merged', dummy.next, { states: Object.fromEntries(walk(dummy.next).nodes.map((n) => [n.id, 'success' as CellState])) })],
    tone: 'success',
    result: `return ${walk(dummy.next).nodes.map((n) => n.val).join(' → ')}`,
  });
}

/* ── Linked List Cycle ────────────────────────────────────────────────────── */

function hasCycle(r: Recorder, values: number[], cycleIndex: number) {
  const head = build(values);
  const nodes = walk(head).nodes;
  if (cycleIndex >= 0) nodes[nodes.length - 1].next = nodes[cycleIndex];

  let slow = head;
  let fast = head;
  const view = (state: CellState = 'active'): Visual[] => [
    lv('head', head, {
      states: {
        ...(slow ? { [slow.id]: state } : {}),
        ...(fast ? { [fast.id]: slow === fast ? state : ('compare' as CellState) } : {}),
      },
      pointers: [
        { name: 'slow', node: slow },
        { name: 'fast', node: fast, tone: 2 },
      ],
    }),
  ];

  r.step({
    at: ['ListNode slow = head;', 'ListNode fast = head;'],
    explain:
      "Floyd's algorithm: one pointer takes single steps, the other double steps. In a cycle the fast one gains exactly one position per round, so it must eventually land on the slow one.",
    visuals: view(),
  });

  let guard = 0;
  while (fast && fast.next && guard++ < 40) {
    slow = slow!.next;
    fast = fast.next.next;
    r.step({
      at: ['slow = slow.next;', 'fast = fast.next.next;'],
      explain: `slow is at ${slow ? slow.val : 'null'}, fast is at ${fast ? fast.val : 'null'}.`,
      vars: { slow: slow ? slow.val : 'null', fast: fast ? fast.val : 'null' },
      visuals: view(),
    });

    if (slow === fast) {
      r.step({
        at: ['if (slow == fast) {', 'return true;'],
        explain: 'The two pointers met, which can only happen inside a cycle.',
        visuals: view('success'),
        tone: 'success',
        result: 'return true',
      });
      return;
    }
  }

  r.step({
    at: 'return false;',
    explain: 'fast reached the end of the list, so there is no cycle to trap it.',
    visuals: view('idle'),
    tone: 'error',
    result: 'return false',
  });
}

/* ── Add Two Numbers ──────────────────────────────────────────────────────── */

function addTwoNumbers(r: Recorder, a: number[], b: number[]) {
  let l1 = build(a, 'a');
  let l2 = build(b, 'b');
  const dummy = node(0, 'd');
  let curr = dummy;
  let carry = 0;

  const view = (): Visual[] => [
    lv('l1  (digits are least-significant first)', l1, {
      states: l1 ? { [l1.id]: 'active' } : {},
      pointers: [{ name: 'l1', node: l1 }],
    }),
    lv('l2', l2, { states: l2 ? { [l2.id]: 'compare' } : {}, pointers: [{ name: 'l2', node: l2, tone: 2 }] }),
    lv('dummy → result', dummy, {
      states: { [dummy.id]: 'muted', [curr.id]: 'done' },
      pointers: [{ name: 'curr', node: curr, tone: 3 }],
      labels: { [dummy.id]: 'dummy' },
      note: `carry = ${carry}`,
    }),
  ];

  r.step({
    at: ['ListNode curr = new ListNode(0);', 'int carry = 0;'],
    explain: 'The digits are stored least-significant first, which is exactly the order in which you add by hand.',
    visuals: view(),
  });

  while (l1 || l2) {
    const val1 = l1 ? (l1.val as number) : 0;
    const val2 = l2 ? (l2.val as number) : 0;
    const val3 = val1 + val2 + carry;
    const prevCarry = carry;
    carry = val3 > 9 ? 1 : 0;
    const digit = val3 % 10;

    const newNode = node(digit, 'r');
    curr.next = newNode;
    curr = newNode;
    r.step({
      at: ['int val3 = val1 + val2 + carry;', 'carry = val3 > 9 ? 1 : 0;', 'curr.next = new ListNode(val3 % 10);'],
      explain: `${val1} + ${val2} + ${prevCarry} = ${val3} → write ${digit}${carry ? ' and carry 1' : ''}.`,
      vars: { val1, val2, val3, carry, digit },
      visuals: view(),
    });

    l1 = l1 ? l1.next : null;
    l2 = l2 ? l2.next : null;
  }

  if (carry > 0) {
    curr.next = node(1, 'r');
    r.step({
      at: 'curr.next = carry > 0 ? new ListNode(1) : null;',
      explain: 'Both lists are exhausted but a carry is left, so it needs one final node.',
      vars: { carry },
      visuals: view(),
    });
  }

  r.step({
    at: 'return dummy.next;',
    explain: 'dummy.next is the head of the sum.',
    visuals: [lv('result', dummy.next, { states: Object.fromEntries(walk(dummy.next).nodes.map((n) => [n.id, 'success' as CellState])) })],
    tone: 'success',
    result: `return ${walk(dummy.next).nodes.map((n) => n.val).join(' → ')}`,
  });
}

/* ── Remove Nth Node From End ─────────────────────────────────────────────── */

function removeNthFromEnd(r: Recorder, values: number[], n: number) {
  const head = build(values);
  const dummy = node(0, 'd');
  dummy.next = head;
  let first = head;
  let second = dummy;
  let left = n;

  const view = (state: CellState = 'active'): Visual[] => [
    lv('dummy → list', dummy, {
      states: {
        [dummy.id]: 'muted',
        ...(first ? { [first.id]: state } : {}),
        ...(second ? { [second.id]: 'compare' as CellState } : {}),
      },
      pointers: [
        { name: 'first', node: first },
        { name: 'second', node: second, tone: 2 },
      ],
      labels: { [dummy.id]: 'dummy' },
    }),
  ];

  r.step({
    at: ['ListNode dummy = new ListNode(0, head);', 'ListNode first = head;', 'ListNode second = dummy;'],
    explain: `Two pointers with a fixed gap of n = ${n}. second starts one node earlier (on the dummy) so it lands just before the node to delete.`,
    vars: { n },
    visuals: view(),
  });

  while (left > 0) {
    first = first!.next;
    left--;
    r.step({
      at: ['while (n > 0) {', 'first = first.next;@1'],
      explain: `Open the gap: first moves ahead, ${left} step(s) to go.`,
      vars: { n: left, first: first ? first.val : 'null' },
      visuals: view(),
    });
  }

  while (first) {
    first = first.next;
    second = second.next!;
    r.step({
      at: ['while (first != null) {', 'first = first.next;@2', 'second = second.next;'],
      explain: `Both pointers advance together, keeping the gap of ${n}.`,
      vars: { first: first ? first.val : 'null', second: second.val },
      visuals: view(),
    });
  }

  const removed = second.next!;
  r.step({
    at: 'second.next = second.next.next;',
    explain: `first fell off the end, so second sits right before the node to remove (${removed.val}). Unlink it.`,
    vars: { removed: removed.val },
    visuals: [
      lv('dummy → list', dummy, {
        states: { [dummy.id]: 'muted', [removed.id]: 'error', [second.id]: 'active' },
        pointers: [{ name: 'second', node: second, tone: 2 }],
        labels: { [dummy.id]: 'dummy' },
      }),
    ],
    tone: 'warn',
  });
  second.next = removed.next;

  r.step({
    at: 'return dummy.next;',
    explain: 'The dummy keeps this correct even when the removed node was the head itself.',
    visuals: [lv('result', dummy.next, { states: Object.fromEntries(walk(dummy.next).nodes.map((nd) => [nd.id, 'success' as CellState])) })],
    tone: 'success',
    result: `return ${walk(dummy.next).nodes.map((nd) => nd.val).join(' → ')}`,
  });
}

/* ── Reorder List ─────────────────────────────────────────────────────────── */

function reorderList(r: Recorder, values: number[]) {
  const head = build(values);
  let slow = head;
  let fast = head;

  r.step({
    at: ['ListNode slow = head;', 'ListNode fast = head;'],
    explain: 'Three phases: find the middle, reverse the second half, then zip the two halves together.',
    visuals: [lv('head', head, { pointers: [{ name: 'slow', node: slow }, { name: 'fast', node: fast, tone: 2 }] })],
  });

  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
    r.step({
      at: ['slow = slow.next;', 'fast = fast.next.next;'],
      explain: `Phase 1 — fast moves twice as quickly, so when it reaches the end slow is at the middle. slow = ${slow!.val}.`,
      vars: { slow: slow!.val, fast: fast ? fast.val : 'null' },
      visuals: [
        lv('head', head, {
          states: { [slow!.id]: 'active', ...(fast ? { [fast.id]: 'compare' as CellState } : {}) },
          pointers: [{ name: 'slow', node: slow }, { name: 'fast', node: fast, tone: 2 }],
        }),
      ],
    });
  }

  let secondHalf = slow!.next;
  slow!.next = null;
  r.step({
    at: ['ListNode secondHalf = slow.next;', 'slow.next = null;'],
    explain: 'Cut the list in two at the middle.',
    visuals: [
      lv('first half', head, { states: { [slow!.id]: 'done' } }),
      lv('second half', secondHalf, { pointers: [{ name: 'secondHalf', node: secondHalf, tone: 2 }] }),
    ],
  });

  let prev: LNode | null = null;
  while (secondHalf) {
    const tmp: LNode | null = secondHalf.next;
    secondHalf.next = prev;
    prev = secondHalf;
    secondHalf = tmp;
    r.step({
      at: ['ListNode tmp = secondHalf.next;', 'secondHalf.next = slow;', 'slow = secondHalf;'],
      explain: `Phase 2 — reverse the second half in place; it now starts at ${prev.val}.`,
      vars: { reversed: walk(prev).nodes.map((n) => n.val).join(' → ') },
      visuals: [
        lv('first half', head),
        lv('second half, reversed so far', prev, { states: { [prev.id]: 'active' } }),
        lv('second half, remaining', secondHalf),
      ],
    });
  }

  let firstHalf: LNode | null = head;
  let second: LNode | null = prev;
  r.step({
    at: ['ListNode firstHalf = head;', 'secondHalf = slow;'],
    explain: 'Phase 3 — walk both halves at once, weaving their nodes together.',
    visuals: [lv('first half', firstHalf), lv('second half (reversed)', second)],
  });

  while (second) {
    const tmp1: LNode | null = firstHalf!.next;
    const tmp2: LNode | null = second.next;
    firstHalf!.next = second;
    second.next = tmp1;
    firstHalf = tmp1;
    second = tmp2;
    r.step({
      at: ['firstHalf.next = secondHalf;', 'secondHalf.next = tmp1;', 'firstHalf = tmp1;'],
      explain: `Splice one node from the back between two nodes from the front.`,
      vars: { list: walk(head).nodes.map((n) => n.val).join(' → ') },
      visuals: [
        lv('list so far', head, {
          states: Object.fromEntries(walk(head).nodes.map((n) => [n.id, 'window' as CellState])),
          pointers: [
            { name: 'firstHalf', node: firstHalf },
            { name: 'secondHalf', node: second, tone: 2 },
          ],
        }),
      ],
    });
  }

  r.step({
    at: 'public void reorderList(ListNode head) {',
    explain: 'The list now alternates first, last, second, second-to-last, …',
    visuals: [lv('result', head, { states: Object.fromEntries(walk(head).nodes.map((n) => [n.id, 'success' as CellState])) })],
    tone: 'success',
    result: walk(head).nodes.map((n) => n.val).join(' → '),
  });
}

/* ── Copy List with Random Pointer ────────────────────────────────────────── */

function copyRandomList(r: Recorder, values: number[], randomIdx: (number | null)[]) {
  const head = build(values, 'o');
  const originals = walk(head).nodes;
  originals.forEach((n, i) => {
    const t = randomIdx[i];
    n.random = t === null ? null : originals[t];
  });

  const randomEdges = (nodes: LNode[]): ListViz['extraEdges'] =>
    nodes
      .filter((n) => n.random)
      .map((n) => ({ from: n.id, to: n.random!.id, label: 'random', dashed: true }));

  const copies = new Map<LNode, LNode>();
  const copyList = () => (copies.size ? copies.get(originals[0])! : null);

  r.step({
    at: 'Map<ListNodeWithRandomPointer, ListNodeWithRandomPointer> originalToCopy = new HashMap<>();',
    explain:
      'A random pointer may target a node that has not been copied yet, so the copy happens in two passes: first create every node, then wire the pointers.',
    visuals: [lv('original', head, { extraEdges: randomEdges(originals) })],
  });

  let curr: LNode | null = head;
  while (curr) {
    const copy = node(curr.val, 'c');
    copies.set(curr, copy);
    r.step({
      at: ['ListNodeWithRandomPointer copy = new ListNodeWithRandomPointer(curr.val);', 'originalToCopy.put(curr, copy);'],
      explain: `Pass 1 — clone ${curr.val} with no links yet, and remember original → copy.`,
      vars: { curr: curr.val, copies: copies.size },
      visuals: [
        lv('original', head, { states: { [curr.id]: 'active' }, pointers: [{ name: 'curr', node: curr }], extraEdges: randomEdges(originals) }),
        mapOf('originalToCopy', [...copies].map(([o, c]) => [`node(${o.val})`, `copy(${c.val})`])),
      ],
    });
    curr = curr.next;
  }

  curr = head;
  while (curr) {
    const copy = copies.get(curr)!;
    copy.next = curr.next ? copies.get(curr.next)! : null;
    copy.random = curr.random ? copies.get(curr.random)! : null;
    r.step({
      at: ['originalToCopy.get(curr).next = originalToCopy.getOrDefault(curr.next, null);', 'originalToCopy.get(curr).random = originalToCopy.getOrDefault(curr.random, null);'],
      explain: `Pass 2 — the copy of ${curr.val} points at the copy of ${curr.next ? curr.next.val : 'null'} (next) and the copy of ${curr.random ? curr.random.val : 'null'} (random).`,
      vars: { curr: curr.val, 'curr.random': curr.random ? curr.random.val : 'null' },
      visuals: [
        lv('original', head, { states: { [curr.id]: 'active' }, pointers: [{ name: 'curr', node: curr }], extraEdges: randomEdges(originals) }),
        lv('deep copy', copyList(), {
          states: { [copy.id]: 'success' },
          extraEdges: randomEdges(walk(copyList()).nodes),
        }),
      ],
    });
    curr = curr.next;
  }

  r.step({
    at: 'return originalToCopy.get(head);',
    explain: 'The copy shares no nodes with the original — mutating one cannot affect the other.',
    visuals: [
      lv('deep copy', copyList(), {
        states: Object.fromEntries(walk(copyList()).nodes.map((n) => [n.id, 'success' as CellState])),
        extraEdges: randomEdges(walk(copyList()).nodes),
      }),
    ],
    tone: 'success',
    result: `return copy of ${values.join(' → ')}`,
  });
}

/* ── Merge K Sorted Lists ─────────────────────────────────────────────────── */

function mergeKLists(r: Recorder, lists: number[][]) {
  const heads: (LNode | null)[] = lists.map((vals, i) => build(vals, `l${i}_`));
  const dummy = node(0, 'd');
  let curr = dummy;

  const view = (minIndex: number, scanning = -1): Visual[] => [
    ...heads.map((h, i) =>
      lv(`lists[${i}]`, h, {
        states: h ? { [h.id]: i === minIndex ? 'success' : i === scanning ? 'compare' : 'active' } : {},
      }),
    ),
    lv('dummy → merged', dummy, {
      states: { [dummy.id]: 'muted', [curr.id]: 'done' },
      pointers: [{ name: 'curr', node: curr, tone: 3 }],
      labels: { [dummy.id]: 'dummy' },
    }),
  ];

  r.step({
    at: ['ListNode dummy = new ListNode(0);', 'ListNode curr = dummy;'],
    explain:
      'Repeatedly pick the smallest head among the k lists. Scanning all k heads each round is O(n·k) — simple, and no heap needed.',
    visuals: view(-1),
  });

  for (;;) {
    let minNodeIndex = -1;
    for (let i = 0; i < heads.length; i++) {
      if (heads[i] === null) continue;
      if (minNodeIndex === -1 || (heads[i]!.val as number) < (heads[minNodeIndex]!.val as number)) minNodeIndex = i;
    }

    if (minNodeIndex === -1) {
      r.step({
        at: ['if (minNodeIndex == -1) {', 'break;'],
        explain: 'Every list is exhausted, so the merge is complete.',
        visuals: view(-1),
      });
      break;
    }

    r.step({
      at: 'if (minNodeIndex == -1 || lists[i].val < lists[minNodeIndex].val) {',
      explain: `The smallest head is ${heads[minNodeIndex]!.val} in lists[${minNodeIndex}].`,
      vars: { minNodeIndex, value: heads[minNodeIndex]!.val },
      visuals: view(minNodeIndex),
    });

    curr.next = heads[minNodeIndex];
    heads[minNodeIndex] = heads[minNodeIndex]!.next;
    curr = curr.next!;
    r.step({
      at: ['curr.next = lists[minNodeIndex];', 'lists[minNodeIndex] = lists[minNodeIndex].next;', 'curr = curr.next;'],
      explain: `Splice that node onto the result and advance lists[${minNodeIndex}]. The node itself is reused, so no memory is allocated.`,
      vars: { merged: walk(dummy.next).nodes.map((n) => n.val).join(' → ') },
      visuals: view(-1),
    });
  }

  r.step({
    at: 'return dummy.next;',
    explain: 'One sorted list built out of the original nodes.',
    visuals: [lv('merged', dummy.next, { states: Object.fromEntries(walk(dummy.next).nodes.map((n) => [n.id, 'success' as CellState])) })],
    tone: 'success',
    result: `return ${walk(dummy.next).nodes.map((n) => n.val).join(' → ')}`,
  });
}

/* ── LRU Cache ────────────────────────────────────────────────────────────── */

type LruOp = ['put', number, number] | ['get', number];

function lruCache(r: Recorder, capacity: number, ops: LruOp[]) {
  // The doubly linked list is modelled as a plain array: index 0 is the LRU end.
  const order: { key: number; value: number }[] = [];
  const map = new Map<number, number>();

  const view = (activeKey?: number, state: CellState = 'active'): Visual[] => [
    {
      kind: 'list',
      title: 'left (LRU) ⟷ right (MRU)',
      nodes: [
        { id: 'left', value: 'left', state: 'muted' },
        ...order.map((e) => ({
          id: `k${e.key}`,
          value: `${e.key}:${e.value}`,
          state: e.key === activeKey ? state : undefined,
        })),
        { id: 'right', value: 'right', state: 'muted' },
      ],
      terminated: false,
      note: `size ${order.length} / capacity ${capacity}`,
    },
    mapOf('map  (key → node)', [...map].map(([k, v]) => [k, `node(${k}:${v})`])),
  ];

  r.step({
    at: ['left = new DoublyLinkedListNode(0, 0);', 'right = new DoublyLinkedListNode(0, 0);'],
    explain:
      'Two sentinel nodes mean no null checks when inserting or removing. The list keeps usage order; the map gives O(1) access to any node.',
    vars: { capacity },
    visuals: view(),
  });

  for (const op of ops) {
    if (op[0] === 'get') {
      const key = op[1];
      if (!map.has(key)) {
        r.step({
          at: 'if (!map.containsKey(key)) return -1;',
          explain: `get(${key}): not in the cache.`,
          vars: { key },
          visuals: view(),
          tone: 'warn',
          result: `get(${key}) = -1`,
        });
        continue;
      }
      const idx = order.findIndex((e) => e.key === key);
      const entry = order.splice(idx, 1)[0];
      order.push(entry);
      r.step({
        at: ['DoublyLinkedListNode node = map.get(key);@1', 'removeNode(node);@1', 'appendRight(node);@1'],
        explain: `get(${key}) = ${entry.value}. Reading counts as a use, so the node is unlinked and re-appended at the MRU end.`,
        vars: { key, value: entry.value },
        visuals: view(key, 'success'),
        tone: 'success',
        result: `get(${key}) = ${entry.value}`,
      });
      continue;
    }

    const [, key, value] = op;
    if (map.has(key)) {
      const idx = order.findIndex((e) => e.key === key);
      const entry = order.splice(idx, 1)[0];
      entry.value = value;
      order.push(entry);
      map.set(key, value);
      r.step({
        at: ['node.value = value;', 'removeNode(node);@2', 'appendRight(node);@2'],
        explain: `put(${key}, ${value}): the key already exists, so update it in place and move it to the MRU end.`,
        vars: { key, value },
        visuals: view(key, 'active'),
      });
      continue;
    }

    order.push({ key, value });
    map.set(key, value);
    r.step({
      at: ['DoublyLinkedListNode node = new DoublyLinkedListNode(key, value);', 'map.put(key, node);', 'appendRight(node);@3', 'size++;'],
      explain: `put(${key}, ${value}): a new node goes to the MRU end.`,
      vars: { key, value, size: order.length, capacity },
      visuals: view(key, 'active'),
    });

    if (order.length > capacity) {
      const evicted = order.shift()!;
      map.delete(evicted.key);
      r.step({
        at: ['if (size > capacity) {', 'DoublyLinkedListNode lru = left.next;', 'map.remove(lru.key);'],
        explain: `The cache is over capacity, so the node next to the left sentinel — key ${evicted.key}, the least recently used — is evicted.`,
        vars: { evicted: evicted.key, size: order.length },
        visuals: view(),
        tone: 'warn',
      });
    }
  }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const linkedListTracers: Record<string, Tracer> = {
  'easy/linkedlist/ReverseLinkedList': {
    examples: [
      { label: '[0,1,2,3]', input: 'head = [0, 1, 2, 3]', run: (r) => reverseList(r, [0, 1, 2, 3]) },
      { label: '[1,2]', input: 'head = [1, 2]', run: (r) => reverseList(r, [1, 2]) },
    ],
  },
  'easy/linkedlist/MergeTwoSortedLinkedLists': {
    examples: [
      { label: '[1,2,4] and [1,3,5]', input: 'list1 = [1, 2, 4], list2 = [1, 3, 5]', run: (r) => mergeTwoLists(r, [1, 2, 4], [1, 3, 5]) },
      { label: 'uneven lengths', input: 'list1 = [1, 7], list2 = [2, 3, 4]', run: (r) => mergeTwoLists(r, [1, 7], [2, 3, 4]) },
    ],
  },
  'easy/linkedlist/LinkedListCycle': {
    examples: [
      { label: 'cycle back to index 1', input: 'head = [3, 2, 0, -4], tail connects to index 1', run: (r) => hasCycle(r, [3, 2, 0, -4], 1) },
      { label: 'no cycle', input: 'head = [1, 2, 3]', run: (r) => hasCycle(r, [1, 2, 3], -1) },
    ],
  },
  'medium/linkedlist/AddTwoNumbers': {
    examples: [
      { label: '342 + 465', input: 'l1 = [2, 4, 3], l2 = [5, 6, 4]   (342 + 465)', run: (r) => addTwoNumbers(r, [2, 4, 3], [5, 6, 4]) },
      { label: '99 + 1', input: 'l1 = [9, 9], l2 = [1]   (99 + 1)', run: (r) => addTwoNumbers(r, [9, 9], [1]) },
    ],
  },
  'medium/linkedlist/RemoveNodeFromEndOfLinkedList': {
    examples: [
      { label: 'n = 2', input: 'head = [1, 2, 3, 4, 5], n = 2', run: (r) => removeNthFromEnd(r, [1, 2, 3, 4, 5], 2) },
      { label: 'remove the head', input: 'head = [1, 2], n = 2', run: (r) => removeNthFromEnd(r, [1, 2], 2) },
    ],
  },
  'medium/linkedlist/ReorderLinkedList': {
    examples: [
      { label: '[2,4,6,8]', input: 'head = [2, 4, 6, 8]', run: (r) => reorderList(r, [2, 4, 6, 8]) },
      { label: '[1,2,3,4,5]', input: 'head = [1, 2, 3, 4, 5]', run: (r) => reorderList(r, [1, 2, 3, 4, 5]) },
    ],
  },
  'medium/linkedlist/CopyLinkedListWithRandomPointer': {
    examples: [
      {
        label: '[7,13,11] with random links',
        input: 'head = [[7,null],[13,0],[11,2]]',
        run: (r) => copyRandomList(r, [7, 13, 11], [null, 0, 2]),
      },
    ],
  },
  'medium/linkedlist/LRUCache': {
    examples: [
      {
        label: 'capacity 2',
        input: 'put(1,1), put(2,2), get(1), put(3,3), get(2), get(3)',
        run: (r) => lruCache(r, 2, [['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['get', 3]]),
      },
    ],
  },
  'hard/linkedlists/MergeKSortedLinkedLists': {
    examples: [
      { label: 'three lists', input: 'lists = [[1, 4, 5], [1, 3, 4], [2, 6]]', run: (r) => mergeKLists(r, [[1, 4, 5], [1, 3, 4], [2, 6]]) },
      { label: 'with an empty list', input: 'lists = [[1, 3], [], [2]]', run: (r) => mergeKLists(r, [[1, 3], [], [2]]) },
    ],
  },
};
