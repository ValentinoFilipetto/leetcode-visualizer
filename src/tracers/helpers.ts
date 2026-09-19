import type {
  ArrayViz,
  BarsViz,
  CellState,
  GraphViz,
  GridViz,
  HeapViz,
  IntervalsViz,
  ListNodeViz,
  ListViz,
  MapViz,
  StackViz,
  TextViz,
  TreeNodeViz,
  TreeViz,
} from '../types';

/* ── Visual builders ──────────────────────────────────────────────────────── */

export function arr(values: (string | number)[], o: Partial<ArrayViz> = {}): ArrayViz {
  return { kind: 'array', values, ...o };
}

export function bars(values: number[], o: Partial<BarsViz> = {}): BarsViz {
  return { kind: 'bars', values, ...o };
}

export function grid(values: (string | number)[][], o: Partial<GridViz> = {}): GridViz {
  return { kind: 'grid', values, ...o };
}

export function mapOf(
  title: string,
  entries: Iterable<[string | number, string | number]>,
  o: Partial<MapViz> = {},
): MapViz {
  return { kind: 'map', title, entries: [...entries].map(([key, value]) => ({ key, value })), emptyHint: '{}', ...o };
}

export function setOf(title: string, keys: Iterable<string | number>, o: Partial<MapViz> = {}): MapViz {
  return { kind: 'map', title, entries: [...keys].map((key) => ({ key })), asSet: true, emptyHint: '{}', ...o };
}

export function stack(title: string, items: (string | number)[], o: Partial<StackViz> = {}): StackViz {
  return { kind: 'stack', title, items: items.map((value) => ({ value })), ...o };
}

export function queue(title: string, items: (string | number)[], o: Partial<StackViz> = {}): StackViz {
  return { kind: 'stack', title, items: items.map((value) => ({ value })), variant: 'queue', ...o };
}

export function frames(title: string, items: (string | number)[], o: Partial<StackViz> = {}): StackViz {
  return {
    kind: 'stack',
    title,
    items: items.map((value) => ({ value })),
    variant: 'frames',
    emptyHint: 'no active calls',
    ...o,
  };
}

export function chips(title: string, lines: string[], o: Partial<TextViz> = {}): TextViz {
  return { kind: 'text', title, lines: lines.map((text) => ({ text })), chips: true, ...o };
}

export function lines(title: string, items: string[], o: Partial<TextViz> = {}): TextViz {
  return { kind: 'text', title, lines: items.map((text) => ({ text })), ...o };
}

export function heap(title: string, items: (string | number)[], heapType: 'min' | 'max', o: Partial<HeapViz> = {}): HeapViz {
  return { kind: 'heap', title, items, heapType, ...o };
}

export function intervalsViz(
  title: string,
  intervals: IntervalsViz['intervals'],
  o: Partial<IntervalsViz> = {},
): IntervalsViz {
  return { kind: 'intervals', title, intervals, ...o };
}

export function tree(root: TreeNodeViz | null, o: Partial<TreeViz> = {}): TreeViz {
  return { kind: 'tree', root, ...o };
}

export function listViz(nodes: ListNodeViz[], o: Partial<ListViz> = {}): ListViz {
  return { kind: 'list', nodes, ...o };
}

export function graphViz(
  nodes: GraphViz['nodes'],
  edges: GraphViz['edges'],
  o: Partial<GraphViz> = {},
): GraphViz {
  return { kind: 'graph', nodes, edges, ...o };
}

/* ── Small utilities used while replaying ─────────────────────────────────── */

/** `'abc'` -> `['a','b','c']` */
export function chars(s: string): string[] {
  return s.split('');
}

/** States for a string/array where a set of indices share one state. */
export function at(length: number, indices: number[], state: CellState): (CellState | undefined)[] {
  const out = new Array<CellState | undefined>(length).fill(undefined);
  for (const i of indices) if (i >= 0 && i < length) out[i] = state;
  return out;
}

/** `[1,2,3]` -> `'[1, 2, 3]'` */
export function list(values: unknown[]): string {
  return `[${values.join(', ')}]`;
}

/** A compact map/set rendering for the variables bar. */
export function mapStr(m: Map<unknown, unknown> | Record<string, unknown>): string {
  const entries = m instanceof Map ? [...m.entries()] : Object.entries(m);
  return `{${entries.map(([k, v]) => `${k}: ${v}`).join(', ')}}`;
}

export function setStr(s: Set<unknown> | unknown[]): string {
  return `{${[...s].join(', ')}}`;
}

/** Builds a binary tree visual from a LeetCode-style level-order array. */
export function treeFromArray(values: (number | string | null)[]): TreeNodeViz | null {
  if (values.length === 0 || values[0] === null) return null;
  const nodes = values.map((v, i) => (v === null ? null : ({ id: `n${i}`, value: v } as TreeNodeViz)));
  let child = 1;
  for (let i = 0; i < nodes.length && child < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    node.left = nodes[child++] ?? null;
    node.right = nodes[child++] ?? null;
  }
  return nodes[0] ?? null;
}

/** Deep-copies a tree so each step keeps its own immutable snapshot. */
export function cloneTree(node: TreeNodeViz | null | undefined): TreeNodeViz | null {
  if (!node) return null;
  return { ...node, left: cloneTree(node.left), right: cloneTree(node.right) };
}

/** Applies `state` to the nodes whose id (or value) is in `ids`. */
export function paintTree(
  node: TreeNodeViz | null,
  states: Record<string, CellState>,
  badges: Record<string, string> = {},
): TreeNodeViz | null {
  if (!node) return null;
  return {
    ...node,
    state: states[node.id] ?? states[String(node.value)],
    badge: badges[node.id] ?? badges[String(node.value)] ?? node.badge,
    left: paintTree(node.left ?? null, states, badges),
    right: paintTree(node.right ?? null, states, badges),
  };
}

/** Walks a tree and returns every node in pre-order. */
export function treeNodes(node: TreeNodeViz | null | undefined): TreeNodeViz[] {
  if (!node) return [];
  return [node, ...treeNodes(node.left), ...treeNodes(node.right)];
}
