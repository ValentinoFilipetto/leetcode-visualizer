/**
 * The vocabulary shared by every tracer and every renderer.
 *
 * A tracer replays a Java solution and emits a list of `Step`s. Each step says
 * which source lines are executing, what changed in plain English, the values of
 * the interesting variables, and one or more `Visual`s describing the state of
 * the data structures at that moment. The player then walks the list forwards
 * and backwards — every step is a complete snapshot, never a diff, so seeking is
 * instant and reversible.
 */

export type CellState =
  | 'idle'
  | 'active' // the element being looked at right now
  | 'compare' // a second element in the comparison
  | 'window' // inside the current sliding window / range
  | 'visited' // already processed
  | 'done' // finalized, will not change again
  | 'success' // part of the answer
  | 'error' // rejected / invalid
  | 'muted'; // out of play

export interface Pointer {
  name: string;
  index: number;
  /** Pointers with the same tone get the same colour across a whole trace. */
  tone?: 1 | 2 | 3 | 4;
  /** Draw above the cells instead of below. */
  above?: boolean;
}

export interface ArrayViz {
  kind: 'array';
  title?: string;
  values: (string | number)[];
  states?: (CellState | undefined)[];
  /** Small caption under each cell, replacing the index. */
  labels?: (string | undefined)[];
  pointers?: Pointer[];
  window?: { from: number; to: number; label?: string };
  /** Show 0-based indices under the cells (default true). */
  indexed?: boolean;
  note?: string;
}

export interface BarsViz {
  kind: 'bars';
  title?: string;
  values: number[];
  states?: (CellState | undefined)[];
  pointers?: Pointer[];
  /** Translucent blocks drawn on top of a bar, e.g. trapped water or a rectangle. */
  overlays?: { index: number; span?: number; from: number; to: number; tone?: 'water' | 'area' | 'ghost'; label?: string }[];
  note?: string;
}

export interface GridViz {
  kind: 'grid';
  title?: string;
  values: (string | number)[][];
  states?: (CellState | undefined)[][];
  cursor?: [number, number];
  /** Extra marks drawn in a cell corner, e.g. BFS distance or visit order. */
  badges?: (string | undefined)[][];
  rowLabels?: string[];
  colLabels?: string[];
  compact?: boolean;
  note?: string;
}

export interface ListNodeViz {
  id: string;
  value: string | number;
  state?: CellState;
  /** Caption under the node. */
  label?: string;
}

export interface ListViz {
  kind: 'list';
  title?: string;
  nodes: ListNodeViz[];
  pointers?: { name: string; nodeId: string | null; tone?: 1 | 2 | 3 | 4 }[];
  /** Curved edges on top of the chain: random pointers, cycles, child lists. */
  extraEdges?: { from: string; to: string; label?: string; dashed?: boolean; tone?: 1 | 2 | 3 | 4 }[];
  /** Render the tail as looping back to this node id. */
  cycleTo?: string;
  /** `null` terminator after the last node (default true). */
  terminated?: boolean;
  note?: string;
}

export interface TreeNodeViz {
  id: string;
  value: string | number;
  state?: CellState;
  badge?: string;
  left?: TreeNodeViz | null;
  right?: TreeNodeViz | null;
  /** Draw the link to the parent as a dashed "not there yet" edge. */
  ghost?: boolean;
}

export interface TreeViz {
  kind: 'tree';
  title?: string;
  root: TreeNodeViz | null;
  note?: string;
}

/**
 * The recursion tree of a backtracking search — one node per call, any number
 * of children. Unlike TreeViz (which mirrors a binary-tree *input*), this
 * renders the algorithm's own exploration: nodes accumulate as the DFS goes
 * deeper and are colour-coded once their branch resolves, so the whole
 * explored search space stays visible instead of being replaced step to step.
 */
export interface DecisionTreeNodeViz {
  id: string;
  /** What this node shows, e.g. the running sum or partial combination. */
  label: string;
  /** The choice that led here, drawn on the incoming edge, e.g. "+2" or "skip 5". */
  edgeLabel?: string;
  state?: CellState;
  children?: DecisionTreeNodeViz[];
}

export interface DecisionTreeViz {
  kind: 'decisionTree';
  title?: string;
  root: DecisionTreeNodeViz | null;
  note?: string;
}

export interface GraphViz {
  kind: 'graph';
  title?: string;
  nodes: { id: string; label: string | number; state?: CellState; badge?: string; x?: number; y?: number }[];
  edges: { from: string; to: string; directed?: boolean; state?: CellState; label?: string }[];
  /** `circle` spreads nodes evenly, `given` uses the x/y on each node (0..1). */
  layout?: 'circle' | 'given';
  note?: string;
}

export interface StackViz {
  kind: 'stack';
  title?: string;
  items: { value: string | number; state?: CellState; label?: string }[];
  /** `stack` grows upwards, `queue` and `frames` read top-to-bottom. */
  variant?: 'stack' | 'queue' | 'frames';
  emptyHint?: string;
  note?: string;
}

export interface HeapViz {
  kind: 'heap';
  title?: string;
  items: (string | number)[];
  heapType: 'min' | 'max';
  states?: (CellState | undefined)[];
  note?: string;
}

export interface MapViz {
  kind: 'map';
  title?: string;
  entries: { key: string | number; value?: string | number; state?: CellState }[];
  /** Render as a set: keys only, no arrow. */
  asSet?: boolean;
  emptyHint?: string;
  note?: string;
}

export interface IntervalsViz {
  kind: 'intervals';
  title?: string;
  intervals: { start: number; end: number; label?: string; state?: CellState; row?: number }[];
  min?: number;
  max?: number;
  note?: string;
}

export interface TextViz {
  kind: 'text';
  title?: string;
  lines: { text: string; state?: CellState }[];
  /** Render each line as a chip instead of a row (good for result collections). */
  chips?: boolean;
  emptyHint?: string;
}

export type Visual =
  | ArrayViz
  | BarsViz
  | GridViz
  | ListViz
  | TreeViz
  | DecisionTreeViz
  | GraphViz
  | StackViz
  | HeapViz
  | MapViz
  | IntervalsViz
  | TextViz;

export interface Step {
  /** 1-based line numbers in the Java source that are "executing" now. */
  lines: number[];
  explain: string;
  vars?: Record<string, string | number | boolean | null | undefined>;
  visuals: Visual[];
  tone?: 'neutral' | 'success' | 'warn' | 'error';
  /** Set on the final step (or any milestone) to surface an answer banner. */
  result?: string;
}

export interface Example {
  label: string;
  /** Shown above the visualization, e.g. `nums = [2,7,11,15], target = 9`. */
  input: string;
  run: (r: import('./trace/recorder').Recorder) => void;
}

export interface Tracer {
  examples: Example[];
}

export interface Solution {
  id: string;
  className: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  categoryLabel: string;
  pattern: string;
  time: string;
  space: string;
  leetcodeSlug: string | null;
  leetcodeNumber: number | null;
  sourcePath: string;
  code: string;
}
