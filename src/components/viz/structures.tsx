import type { DecisionTreeNodeViz, DecisionTreeViz, GraphViz, HeapViz, ListViz, TreeNodeViz, TreeViz } from '../../types';
import { stateClass } from './primitives';

/* ── Binary tree ──────────────────────────────────────────────────────────── */

interface Placed {
  node: TreeNodeViz;
  x: number;
  y: number;
  parent?: Placed;
}

const NODE_R = 19;
const X_GAP = 46;
const Y_GAP = 64;

/** In-order x placement keeps siblings apart and reads left-to-right. */
function layoutTree(root: TreeNodeViz | null): { placed: Placed[]; width: number; height: number } {
  const placed: Placed[] = [];
  let cursor = 0;
  let maxDepth = 0;

  const walk = (node: TreeNodeViz | null | undefined, depth: number, parent?: Placed): Placed | undefined => {
    if (!node) return undefined;
    maxDepth = Math.max(maxDepth, depth);
    const self: Placed = { node, x: 0, y: depth * Y_GAP + NODE_R + 14, parent };
    walk(node.left, depth + 1, self);
    self.x = cursor * X_GAP + NODE_R + 12;
    cursor++;
    placed.push(self);
    walk(node.right, depth + 1, self);
    return self;
  };

  walk(root, 0);
  return { placed, width: Math.max(1, cursor) * X_GAP + 24, height: (maxDepth + 1) * Y_GAP + 24 };
}

export function TreeView({ viz }: { viz: TreeViz }) {
  const { placed, width, height } = layoutTree(viz.root);

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {!viz.root ? (
        <div className="viz-empty">null</div>
      ) : (
        <div className="svg-viz">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
            {placed.map((p, i) =>
              p.parent ? (
                <line
                  key={`e${i}`}
                  className={`edge${p.node.ghost ? ' ghost' : ''}`}
                  x1={p.parent.x}
                  y1={p.parent.y}
                  x2={p.x}
                  y2={p.y}
                />
              ) : null,
            )}
            {placed.map((p, i) => (
              <g key={`n${i}`}>
                <circle className={`node-circle${stateClass(p.node.state)}`} cx={p.x} cy={p.y} r={NODE_R} />
                <text className="node-text" x={p.x} y={p.y}>
                  {p.node.value}
                </text>
                {p.node.badge && (
                  <text className="node-badge" x={p.x} y={p.y - NODE_R - 5}>
                    {p.node.badge}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

/* ── Decision tree: a backtracking search's own recursion tree ───────────── */

interface DPlaced {
  node: DecisionTreeNodeViz;
  x: number;
  y: number;
  w: number;
  parent?: DPlaced;
}

const D_NODE_H = 28;
const D_Y_GAP = 58;

/** Wide enough for the label at 11px mono, capped so one huge label can't blow out the layout. */
function decisionNodeWidth(label: string): number {
  return Math.max(40, Math.min(150, label.length * 6.4 + 20));
}

/**
 * Every leaf gets one horizontal slot (sized to the widest node anywhere in
 * the tree, so nothing overlaps); an internal node centers over its children.
 * The same idea as the binary-tree layout above, generalized to n children.
 */
function layoutDecisionTree(root: DecisionTreeNodeViz | null): { placed: DPlaced[]; width: number; height: number } {
  if (!root) return { placed: [], width: 1, height: 1 };

  let maxWidth = 40;
  const measure = (node: DecisionTreeNodeViz) => {
    maxWidth = Math.max(maxWidth, decisionNodeWidth(node.label));
    (node.children ?? []).forEach(measure);
  };
  measure(root);
  const slot = maxWidth + 24;

  const placed: DPlaced[] = [];
  let cursor = 0;
  let maxDepth = 0;

  const walk = (node: DecisionTreeNodeViz, depth: number, parent?: DPlaced): DPlaced => {
    maxDepth = Math.max(maxDepth, depth);
    const rec: DPlaced = { node, x: 0, y: depth * D_Y_GAP + D_NODE_H / 2 + 14, w: decisionNodeWidth(node.label), parent };
    const kids = node.children ?? [];
    if (kids.length === 0) {
      rec.x = cursor * slot + slot / 2;
      cursor++;
    } else {
      const childRecs = kids.map((c) => walk(c, depth + 1, rec));
      rec.x = (Math.min(...childRecs.map((c) => c.x)) + Math.max(...childRecs.map((c) => c.x))) / 2;
    }
    placed.push(rec);
    return rec;
  };

  walk(root, 0);
  return { placed, width: Math.max(1, cursor) * slot + 16, height: (maxDepth + 1) * D_Y_GAP + 26 };
}

export function DecisionTreeView({ viz }: { viz: DecisionTreeViz }) {
  const { placed, width, height } = layoutDecisionTree(viz.root);

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {!viz.root ? (
        <div className="viz-empty">empty</div>
      ) : (
        <div className="svg-viz">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
            {placed.map((p, i) => {
              if (!p.parent) return null;
              const mx = (p.parent.x + p.x) / 2;
              const my = (p.parent.y + p.y) / 2 - 6;
              const labelW = (p.node.edgeLabel?.length ?? 0) * 5.6 + 8;
              return (
                <g key={`e${i}`}>
                  <line className="edge" x1={p.parent.x} y1={p.parent.y + D_NODE_H / 2} x2={p.x} y2={p.y - D_NODE_H / 2} />
                  {p.node.edgeLabel && (
                    <>
                      <rect className="dtree-edge-label-bg" x={mx - labelW / 2} y={my - 8} width={labelW} height={13} rx={4} />
                      <text className="edge-label" x={mx} y={my - 1}>
                        {p.node.edgeLabel}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {placed.map((p, i) => (
              <g key={`n${i}`}>
                <rect
                  className={`node-circle${stateClass(p.node.state)}`}
                  x={p.x - p.w / 2}
                  y={p.y - D_NODE_H / 2}
                  width={p.w}
                  height={D_NODE_H}
                  rx={8}
                />
                <text className="node-text" x={p.x} y={p.y}>
                  {p.node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

/* ── Heap: array plus the implicit binary tree ────────────────────────────── */

export function HeapView({ viz }: { viz: HeapViz }) {
  const build = (i: number): TreeNodeViz | null => {
    if (i >= viz.items.length) return null;
    return {
      id: `h${i}`,
      value: viz.items[i],
      state: viz.states?.[i],
      badge: String(i),
      left: build(2 * i + 1),
      right: build(2 * i + 2),
    };
  };

  return (
    <div className="viz-block">
      {viz.title && (
        <div className="viz-title">
          {viz.title} · {viz.heapType}-heap
        </div>
      )}
      {viz.items.length === 0 ? (
        <div className="viz-empty">empty</div>
      ) : (
        <div className="heap-wrap">
          <TreeView viz={{ kind: 'tree', root: build(0) }} />
          <div className="array-viz" style={{ paddingTop: 0 }}>
            {viz.items.map((v, i) => (
              <div className="array-slot" key={i}>
                <div className={`cell${stateClass(viz.states?.[i])}`}>{v}</div>
                <div className="slot-index">{i}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

/* ── Linked list ──────────────────────────────────────────────────────────── */

const L_W = 52;
const L_H = 38;
const L_GAP = 34;

export function ListView({ viz }: { viz: ListViz }) {
  const { nodes, pointers = [], extraEdges = [], cycleTo } = viz;
  const terminated = viz.terminated !== false && !cycleTo;
  const topPad = 34;
  const bottomPad = cycleTo || extraEdges.length ? 52 : 24;
  const width = Math.max(1, nodes.length) * (L_W + L_GAP) + (terminated ? 44 : 10) + 12;
  const height = topPad + L_H + bottomPad;
  const xOf = (i: number) => 8 + i * (L_W + L_GAP);
  const cx = (i: number) => xOf(i) + L_W / 2;
  const indexOfId = (id: string) => nodes.findIndex((n) => n.id === id);

  const pointerRows: Record<number, string[]> = {};
  for (const p of pointers) {
    const i = p.nodeId === null ? nodes.length : indexOfId(p.nodeId);
    if (i < 0) continue;
    (pointerRows[i] ??= []).push(p.name);
  }

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {nodes.length === 0 ? (
        <div className="viz-empty">null</div>
      ) : (
        <div className="svg-viz">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
            <defs>
              <marker id="lv-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 z" fill="currentColor" />
              </marker>
            </defs>

            {nodes.map((n, i) => {
              const last = i === nodes.length - 1;
              const y = topPad + L_H / 2;
              const next = xOf(i) + L_W;
              return (
                <g key={n.id}>
                  {(!last || terminated) && (
                    <line
                      className="edge"
                      x1={next + 3}
                      y1={y}
                      x2={next + L_GAP - 6}
                      y2={y}
                      markerEnd="url(#lv-arrow)"
                      style={{ color: 'var(--text-faint)' }}
                    />
                  )}
                  <rect
                    className={`node-circle${stateClass(n.state)}`}
                    x={xOf(i)}
                    y={topPad}
                    width={L_W}
                    height={L_H}
                    rx={10}
                  />
                  <text className="node-text" x={cx(i)} y={topPad + L_H / 2}>
                    {n.value}
                  </text>
                  {n.label && (
                    <text className="node-badge" x={cx(i)} y={topPad + L_H + 13}>
                      {n.label}
                    </text>
                  )}
                  {pointerRows[i] && (
                    <text className="node-badge" x={cx(i)} y={topPad - 10} style={{ fill: 'var(--accent)' }}>
                      {pointerRows[i].join(' ')}
                    </text>
                  )}
                </g>
              );
            })}

            {terminated && (
              <text className="node-badge" x={xOf(nodes.length - 1) + L_W + L_GAP + 8} y={topPad + L_H / 2 + 4}>
                null
              </text>
            )}
            {pointerRows[nodes.length] && (
              <text
                className="node-badge"
                x={xOf(nodes.length - 1) + L_W + L_GAP + 8}
                y={topPad - 10}
                style={{ fill: 'var(--accent)' }}
              >
                {pointerRows[nodes.length].join(' ')}
              </text>
            )}

            {extraEdges.map((e, k) => {
              const a = indexOfId(e.from);
              const b = indexOfId(e.to);
              if (a < 0 || b < 0) return null;
              const y0 = topPad + L_H;
              const dip = 26 + (k % 2) * 10;
              return (
                <g key={`x${k}`}>
                  <path
                    className={`edge${e.dashed ? ' ghost' : ''}`}
                    d={`M ${cx(a)} ${y0} Q ${(cx(a) + cx(b)) / 2} ${y0 + dip * 1.6} ${cx(b)} ${y0}`}
                    markerEnd="url(#lv-arrow)"
                    style={{ color: 'var(--text-faint)' }}
                  />
                  {e.label && (
                    <text className="edge-label" x={(cx(a) + cx(b)) / 2} y={y0 + dip + 6}>
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {cycleTo &&
              (() => {
                const a = nodes.length - 1;
                const b = indexOfId(cycleTo);
                if (b < 0) return null;
                const y0 = topPad + L_H;
                return (
                  <path
                    className="edge s-error"
                    d={`M ${cx(a)} ${y0} Q ${(cx(a) + cx(b)) / 2} ${y0 + 48} ${cx(b)} ${y0}`}
                    markerEnd="url(#lv-arrow)"
                    style={{ color: 'var(--s-error)' }}
                  />
                );
              })()}
          </svg>
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

/* ── Graph ────────────────────────────────────────────────────────────────── */

export function GraphView({ viz }: { viz: GraphViz }) {
  const W = Math.max(340, Math.min(620, viz.nodes.length * 80));
  const H = 260;
  const R = 20;
  const pad = 40;

  const positions = new Map<string, { x: number; y: number }>();
  viz.nodes.forEach((n, i) => {
    if (viz.layout === 'given' && n.x !== undefined && n.y !== undefined) {
      positions.set(n.id, { x: pad + n.x * (W - 2 * pad), y: pad + n.y * (H - 2 * pad) });
    } else {
      const angle = (i / viz.nodes.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(n.id, {
        x: W / 2 + Math.cos(angle) * (W / 2 - pad),
        y: H / 2 + Math.sin(angle) * (H / 2 - pad),
      });
    }
  });

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      <div className="svg-viz">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
          <defs>
            <marker id="gv-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 z" fill="currentColor" />
            </marker>
          </defs>
          {viz.edges.map((e, i) => {
            const a = positions.get(e.from);
            const b = positions.get(e.to);
            if (!a || !b) return null;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const x1 = a.x + ux * R;
            const y1 = a.y + uy * R;
            const x2 = b.x - ux * (R + (e.directed ? 6 : 0));
            const y2 = b.y - uy * (R + (e.directed ? 6 : 0));
            return (
              <g key={i}>
                <line
                  className={`edge${stateClass(e.state)}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  markerEnd={e.directed ? 'url(#gv-arrow)' : undefined}
                  style={e.directed ? { color: 'currentColor' } : undefined}
                />
                {e.label && (
                  <text className="edge-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5}>
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {viz.nodes.map((n) => {
            const p = positions.get(n.id)!;
            return (
              <g key={n.id}>
                <circle className={`node-circle${stateClass(n.state)}`} cx={p.x} cy={p.y} r={R} />
                <text className="node-text" x={p.x} y={p.y}>
                  {n.label}
                </text>
                {n.badge && (
                  <text className="node-badge" x={p.x} y={p.y - R - 6}>
                    {n.badge}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}
