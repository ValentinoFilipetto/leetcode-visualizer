import type { Recorder } from '../trace/recorder';
import type { CellState, GraphViz, Tracer, Visual } from '../types';
import { arr, frames, graphViz, grid, queue } from './helpers';

/* ── Shared grid helpers ──────────────────────────────────────────────────── */

type Grid<T> = T[][];

function states<T>(g: Grid<T>, fn: (v: T, r: number, c: number) => CellState | undefined): (CellState | undefined)[][] {
  return g.map((row, r) => row.map((v, c) => fn(v, r, c)));
}

/* ── Flood Fill ───────────────────────────────────────────────────────────── */

function floodFill(r: Recorder, image: number[][], sr: number, sc: number, color: number) {
  const ROWS = image.length;
  const COLS = image[0].length;
  const originalColor = image[sr][sc];
  const stack = frames('call stack', []);
  const calls: string[] = [];

  const view = (rr: number, cc: number, state: CellState): Visual[] => [
    grid(image, {
      title: 'image',
      cursor: rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS ? [rr, cc] : undefined,
      states: states(image, (v, r2, c2) => (r2 === rr && c2 === cc ? state : v === color ? ('success' as CellState) : undefined)),
    }),
    { ...stack, items: calls.slice().reverse().map((value) => ({ value })) },
  ];

  r.step({
    at: ['this.originalColor = image[sr][sc];', 'flood(image, sr, sc);'],
    explain: `Start at (${sr}, ${sc}), whose colour is ${originalColor}. Every 4-directionally connected cell of that colour becomes ${color}.`,
    vars: { sr, sc, color, originalColor },
    visuals: view(sr, sc, 'active'),
  });

  const flood = (rr: number, cc: number) => {
    if (rr < 0 || cc < 0 || rr === ROWS || cc === COLS) {
      r.step({
        at: 'if (r < 0 || c < 0 || r == ROWS || c == COLS || image[r][c] != originalColor',
        explain: `(${rr}, ${cc}) is outside the image — stop this branch.`,
        vars: { r: rr, c: cc },
        visuals: view(rr, cc, 'error'),
      });
      return;
    }
    if (image[rr][cc] !== originalColor || image[rr][cc] === color) {
      r.step({
        at: '|| image[r][c] == color) return;',
        explain: `(${rr}, ${cc}) holds ${image[rr][cc]} — ${image[rr][cc] === color ? 'already recoloured' : 'a different colour'}, so stop.`,
        vars: { r: rr, c: cc, value: image[rr][cc] },
        visuals: view(rr, cc, 'error'),
      });
      return;
    }

    image[rr][cc] = color;
    calls.push(`flood(${rr}, ${cc})`);
    r.step({
      at: 'image[r][c] = color;',
      explain: `Recolour (${rr}, ${cc}) to ${color}, then explore its four neighbours.`,
      vars: { r: rr, c: cc, depth: calls.length },
      visuals: view(rr, cc, 'active'),
      tone: 'success',
    });

    flood(rr + 1, cc);
    flood(rr, cc + 1);
    flood(rr - 1, cc);
    flood(rr, cc - 1);
    calls.pop();
  };

  flood(sr, sc);
  r.step({
    at: 'return image;',
    explain: 'The whole connected region has the new colour.',
    visuals: [grid(image, { title: 'image', states: states(image, (v) => (v === color ? 'success' : undefined)) })],
    tone: 'success',
    result: `return ${JSON.stringify(image)}`,
  });
}

/* ── Number of Islands ────────────────────────────────────────────────────── */

function numIslands(r: Recorder, input: string[][]) {
  const g = input.map((row) => row.slice());
  const ROWS = g.length;
  const COLS = g[0].length;
  let count = 0;
  const calls: string[] = [];

  const view = (rr: number, cc: number, state: CellState): Visual[] => [
    grid(g, {
      title: "grid  ('1' = land, '0' = water or already visited)",
      cursor: rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS ? [rr, cc] : undefined,
      states: states(g, (v, r2, c2) => (r2 === rr && c2 === cc ? state : v === '1' ? ('window' as CellState) : ('muted' as CellState))),
      note: `islands so far: ${count}`,
    }),
    frames('call stack', calls.slice().reverse()),
  ];

  r.step({
    at: 'int numberOfIslands = 0;',
    explain: 'Scan every cell. Each unvisited piece of land starts a new island, and a DFS sinks the whole island so it is never counted twice.',
    visuals: view(-1, -1, 'idle'),
  });

  const dfs = (rr: number, cc: number) => {
    if (rr < 0 || cc < 0 || rr === ROWS || cc === COLS || g[rr][cc] === '0') {
      return;
    }
    g[rr][cc] = '0';
    calls.push(`dfs(${rr}, ${cc})`);
    r.step({
      at: ["grid[r][c] = '0';", 'dfs(grid, r + 1, c);'],
      explain: `(${rr}, ${cc}) belongs to island ${count}. Marking it '0' doubles as the visited flag — no extra visited set needed.`,
      vars: { r: rr, c: cc, depth: calls.length },
      visuals: view(rr, cc, 'active'),
    });
    dfs(rr + 1, cc);
    dfs(rr, cc + 1);
    dfs(rr - 1, cc);
    dfs(rr, cc - 1);
    calls.pop();
  };

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (g[rr][cc] === '1') {
        count++;
        r.step({
          at: ["if (grid[r][c] == '1') {", 'numberOfIslands++;'],
          explain: `(${rr}, ${cc}) is land that has not been visited — island number ${count}.`,
          vars: { r: rr, c: cc, numberOfIslands: count },
          visuals: view(rr, cc, 'success'),
          tone: 'success',
        });
        dfs(rr, cc);
      }
    }
  }

  r.step({
    at: 'return numberOfIslands;',
    explain: `Every cell has been visited; ${count} separate islands were found.`,
    vars: { numberOfIslands: count },
    visuals: [grid(g, { title: 'grid (all sunk)' })],
    tone: 'success',
    result: `return ${count}`,
  });
}

/* ── Max Area of Island ───────────────────────────────────────────────────── */

function maxAreaOfIsland(r: Recorder, input: number[][]) {
  const g = input.map((row) => row.slice());
  const ROWS = g.length;
  const COLS = g[0].length;
  let maxArea = 0;
  const calls: string[] = [];

  const view = (rr: number, cc: number, state: CellState, note: string): Visual[] => [
    grid(g, {
      title: 'grid',
      cursor: rr >= 0 ? [rr, cc] : undefined,
      states: states(g, (v, r2, c2) => (r2 === rr && c2 === cc ? state : v === 1 ? ('window' as CellState) : ('muted' as CellState))),
      note,
    }),
    frames('call stack', calls.slice().reverse()),
  ];

  const dfs = (rr: number, cc: number): number => {
    if (rr < 0 || cc < 0 || rr === ROWS || cc === COLS || g[rr][cc] === 0) return 0;
    g[rr][cc] = 0;
    calls.push(`dfs(${rr}, ${cc})`);
    r.step({
      at: ['grid[r][c] = 0;', 'return 1 + dfs(grid, r + 1, c, area + 1) +'],
      explain: `(${rr}, ${cc}) counts 1 for itself; its neighbours add the rest of the island.`,
      vars: { r: rr, c: cc, depth: calls.length },
      visuals: view(rr, cc, 'active', `best area so far: ${maxArea}`),
    });
    const area = 1 + dfs(rr + 1, cc) + dfs(rr, cc + 1) + dfs(rr - 1, cc) + dfs(rr, cc - 1);
    calls.pop();
    return area;
  };

  r.step({
    at: 'int maxArea = 0;',
    explain: 'Same sinking DFS as "Number of Islands", except each call returns how many cells it consumed.',
    visuals: view(-1, -1, 'idle', 'best area so far: 0'),
  });

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (g[rr][cc] === 1) {
        const area = dfs(rr, cc);
        const improved = area > maxArea;
        maxArea = Math.max(maxArea, area);
        r.step({
          at: 'maxArea = Math.max(maxArea, dfs(grid, r, c, 0));',
          explain: `The island starting at (${rr}, ${cc}) has area ${area}.${improved ? ' That is the largest so far.' : ''}`,
          vars: { r: rr, c: cc, area, maxArea },
          visuals: view(rr, cc, improved ? 'success' : 'done', `best area so far: ${maxArea}`),
          tone: improved ? 'success' : 'neutral',
        });
      }
    }
  }

  r.step({
    at: 'return maxArea;',
    explain: `The largest island covers ${maxArea} cells.`,
    vars: { maxArea },
    visuals: [grid(g, { title: 'grid (all sunk)' })],
    tone: 'success',
    result: `return ${maxArea}`,
  });
}

/* ── Surrounded Regions ───────────────────────────────────────────────────── */

function surroundedRegions(r: Recorder, input: string[][]) {
  const b = input.map((row) => row.slice());
  const rows = b.length;
  const cols = b[0].length;

  const view = (rr: number, cc: number, state: CellState, note: string): Visual[] => [
    grid(b, {
      title: 'board',
      cursor: rr >= 0 ? [rr, cc] : undefined,
      states: states(b, (v, r2, c2) =>
        r2 === rr && c2 === cc ? state : v === '*' ? ('success' as CellState) : v === 'O' ? ('window' as CellState) : ('muted' as CellState),
      ),
      note,
    }),
  ];

  const dfs = (rr: number, cc: number) => {
    if (rr < 0 || cc < 0 || rr === rows || cc === cols || b[rr][cc] === 'X' || b[rr][cc] === '*') return;
    b[rr][cc] = '*';
    r.step({
      at: ["board[r][c] = '*';", 'dfs(board, r + 1, c);'],
      explain: `(${rr}, ${cc}) is reachable from the border, so it can never be captured — mark it '*'.`,
      vars: { r: rr, c: cc },
      visuals: view(rr, cc, 'success', "'*' = safe, connected to the border"),
    });
    dfs(rr + 1, cc);
    dfs(rr, cc + 1);
    dfs(rr - 1, cc);
    dfs(rr, cc - 1);
  };

  r.step({
    at: 'public void solve(char[][] board) {',
    explain:
      'Instead of proving a region is enclosed, prove the opposite: any O touching the border escapes, and so does everything connected to it. Whatever is left must be surrounded.',
    visuals: view(-1, -1, 'idle', ''),
  });

  for (let rr = 0; rr < rows; rr++) {
    if (b[rr][0] === 'O') {
      r.step({
        at: "if (board[r][0] == 'O') {",
        explain: `(${rr}, 0) is an O on the left border — everything connected to it is safe.`,
        visuals: view(rr, 0, 'active', 'scanning the left and right borders'),
      });
      dfs(rr, 0);
    }
    if (b[rr][cols - 1] === 'O') {
      r.step({
        at: "if (board[r][cols - 1] == 'O') {",
        explain: `(${rr}, ${cols - 1}) is an O on the right border.`,
        visuals: view(rr, cols - 1, 'active', 'scanning the left and right borders'),
      });
      dfs(rr, cols - 1);
    }
  }
  for (let cc = 0; cc < cols; cc++) {
    if (b[0][cc] === 'O') {
      r.step({
        at: "if (board[0][c] == 'O') {",
        explain: `(0, ${cc}) is an O on the top border.`,
        visuals: view(0, cc, 'active', 'scanning the top and bottom borders'),
      });
      dfs(0, cc);
    }
    if (b[rows - 1][cc] === 'O') {
      r.step({
        at: "if (board[rows - 1][c] == 'O') {",
        explain: `(${rows - 1}, ${cc}) is an O on the bottom border.`,
        visuals: view(rows - 1, cc, 'active', 'scanning the top and bottom borders'),
      });
      dfs(rows - 1, cc);
    }
  }

  r.step({
    at: '// Explore the board one final time:',
    explain: "Final sweep: every '*' goes back to 'O', and every remaining 'O' was enclosed, so it flips to 'X'.",
    visuals: view(-1, -1, 'idle', ''),
  });

  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (b[rr][cc] === '*') {
        b[rr][cc] = 'O';
        r.step({
          at: "if (board[r][c] == '*') board[r][c] = 'O';",
          explain: `(${rr}, ${cc}) was marked safe — restore it to 'O'.`,
          visuals: view(rr, cc, 'success', ''),
        });
      } else if (b[rr][cc] === 'O') {
        b[rr][cc] = 'X';
        r.step({
          at: "else if (board[r][c] == 'O') board[r][c] = 'X';",
          explain: `(${rr}, ${cc}) is an 'O' the border search never reached, so it is surrounded — capture it.`,
          visuals: view(rr, cc, 'error', ''),
          tone: 'warn',
        });
      }
    }
  }

  r.step({
    at: 'public void solve(char[][] board) {',
    explain: 'Only the regions touching the border survived.',
    visuals: [grid(b, { title: 'board' })],
    tone: 'success',
    result: 'board updated in place',
  });
}

/* ── Rotting Oranges ──────────────────────────────────────────────────────── */

function orangesRotting(r: Recorder, input: number[][]) {
  const g = input.map((row) => row.slice());
  const rows = g.length;
  const cols = g[0].length;
  const q: [number, number][] = [];
  let fresh = 0;
  let minutes = 0;

  const label = (v: number) => (v === 0 ? '·' : v === 1 ? '1' : '2');
  const view = (cursor?: [number, number]): Visual[] => [
    grid(g.map((row) => row.map(label)), {
      title: 'grid  (· empty, 1 fresh, 2 rotten)',
      cursor,
      states: states(g, (v, r2, c2) =>
        cursor && cursor[0] === r2 && cursor[1] === c2 ? 'active' : v === 2 ? ('error' as CellState) : v === 1 ? ('window' as CellState) : ('muted' as CellState),
      ),
      note: `minute ${minutes} · fresh left: ${fresh}`,
    }),
    queue('queue', q.map(([a, b]) => `(${a}, ${b})`)),
  ];

  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (g[rr][cc] === 2) q.push([rr, cc]);
      if (g[rr][cc] === 1) fresh++;
    }
  }

  r.step({
    at: ['if (grid[r][c] == 2) {', 'if (grid[r][c] == 1) {'],
    explain: `Multi-source BFS: every orange that is already rotten starts in the queue (${q.length} of them), and ${fresh} fresh oranges must be reached.`,
    vars: { fresh, queueSize: q.length },
    visuals: view(),
  });

  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  while (fresh > 0 && q.length > 0) {
    const queueSize = q.length;
    r.step({
      at: 'int queueSize = queue.size();',
      explain: `Minute ${minutes + 1}: the ${queueSize} orange(s) currently in the queue rot their neighbours simultaneously.`,
      vars: { queueSize, minutes, fresh },
      visuals: view(),
    });

    for (let i = 0; i < queueSize; i++) {
      const [cr, cc] = q.shift()!;
      for (const [dr, dc] of dirs) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr < 0 || nc < 0 || nr === rows || nc === cols || g[nr][nc] === 0 || g[nr][nc] === 2) continue;
        g[nr][nc] = 2;
        fresh--;
        q.push([nr, nc]);
        r.step({
          at: ['grid[newRow][newCol] = 2;', 'fresh--;', 'queue.add(new int[]{ newRow, newCol });'],
          explain: `(${cr}, ${cc}) rots its neighbour (${nr}, ${nc}). Marking it rotten immediately also prevents it being queued twice.`,
          vars: { currentRow: cr, currentCol: cc, newRow: nr, newCol: nc, fresh },
          visuals: view([nr, nc]),
          tone: 'warn',
        });
      }
    }
    minutes++;
  }

  r.step({
    at: 'return fresh > 0 ? -1 : minutes;',
    explain:
      fresh > 0
        ? `${fresh} orange(s) can never be reached — they have no rotten neighbour, so the answer is −1.`
        : `Every orange rotted after ${minutes} minute(s).`,
    vars: { fresh, minutes },
    visuals: view(),
    tone: fresh > 0 ? 'error' : 'success',
    result: `return ${fresh > 0 ? -1 : minutes}`,
  });
}

/* ── Islands and Treasure (Walls and Gates) ───────────────────────────────── */

const INF = 2147483647;

function islandsAndTreasure(r: Recorder, input: number[][]) {
  const g = input.map((row) => row.slice());
  const ROWS = g.length;
  const COLS = g[0].length;
  const q: [number, number][] = [];

  const label = (v: number) => (v === INF ? '∞' : v === -1 ? 'W' : String(v));
  const view = (cursor?: [number, number]): Visual[] => [
    grid(g.map((row) => row.map(label)), {
      title: 'grid  (W = wall, 0 = treasure, ∞ = unreached land)',
      cursor,
      states: states(g, (v, r2, c2) =>
        cursor && cursor[0] === r2 && cursor[1] === c2
          ? 'active'
          : v === -1
            ? ('muted' as CellState)
            : v === 0
              ? ('success' as CellState)
              : v === INF
                ? undefined
                : ('window' as CellState),
      ),
    }),
    queue('queue', q.map(([a, b]) => `(${a}, ${b})`)),
  ];

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) if (g[rr][cc] === 0) q.push([rr, cc]);
  }

  r.step({
    at: 'if (grid[r][c] == 0) {',
    explain:
      'Run BFS from every treasure at once instead of from every land cell. The first time a cell is reached, it is reached by the nearest treasure.',
    vars: { treasures: q.length },
    visuals: view(),
  });

  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  while (q.length > 0) {
    const [cr, cc] = q.shift()!;
    r.step({
      at: 'int[] cell = queue.poll();',
      explain: `Expand from (${cr}, ${cc}), which is ${g[cr][cc]} step(s) from a treasure.`,
      vars: { currentRow: cr, currentCol: cc, value: g[cr][cc] },
      visuals: view([cr, cc]),
    });
    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nc < 0 || nr === ROWS || nc === COLS || g[nr][nc] !== INF) continue;
      g[nr][nc] = g[cr][cc] + 1;
      q.push([nr, nc]);
      r.step({
        at: ['grid[newRow][newCol] = grid[currentRow][currentCol] + 1;', 'queue.add(new int[]{ newRow, newCol });'],
        explain: `(${nr}, ${nc}) is untouched land, so its distance is ${g[cr][cc]} + 1 = ${g[nr][nc]}. Writing the value is also the visited mark.`,
        vars: { newRow: nr, newCol: nc, distance: g[nr][nc] },
        visuals: view([nr, nc]),
        tone: 'success',
      });
    }
  }

  r.step({
    at: 'public void islandsAndTreasure(int[][] grid) {',
    explain: 'Every reachable cell now holds its distance to the nearest treasure; unreachable land keeps ∞.',
    visuals: [grid(g.map((row) => row.map(label)), { title: 'grid' })],
    tone: 'success',
    result: 'grid updated in place',
  });
}

/* ── 01 Matrix ────────────────────────────────────────────────────────────── */

function updateMatrix(r: Recorder, input: number[][]) {
  const mat = input.map((row) => row.slice());
  const ROWS = mat.length;
  const COLS = mat[0].length;
  const q: [number, number][] = [];

  const label = (v: number) => (v === -1 ? '?' : String(v));
  const view = (cursor?: [number, number]): Visual[] => [
    grid(mat.map((row) => row.map(label)), {
      title: 'mat  (? = not reached yet)',
      cursor,
      states: states(mat, (v, r2, c2) =>
        cursor && cursor[0] === r2 && cursor[1] === c2 ? 'active' : v === 0 ? ('success' as CellState) : v === -1 ? ('muted' as CellState) : ('window' as CellState),
      ),
    }),
    queue('queue', q.map(([a, b]) => `(${a}, ${b})`)),
  ];

  for (let rr = 0; rr < ROWS; rr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (mat[rr][cc] === 0) q.push([rr, cc]);
      else mat[rr][cc] = -1;
    }
  }

  r.step({
    at: ['if (mat[r][c] == 0) {', '} else mat[r][c] = -1;'],
    explain:
      'Every 0 is a BFS source. The 1s are rewritten to −1 to mean "distance unknown", which doubles as the visited marker.',
    vars: { sources: q.length },
    visuals: view(),
  });

  const dirs: [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1]];
  while (q.length > 0) {
    const [cr, cc] = q.shift()!;
    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS || mat[nr][nc] !== -1) continue;
      mat[nr][nc] = mat[cr][cc] + 1;
      q.push([nr, nc]);
      r.step({
        at: ['mat[nr][nc] = mat[cell[0]][cell[1]] + 1;', 'queue.add(new int[]{ nr, nc });'],
        explain: `(${nr}, ${nc}) is first reached from (${cr}, ${cc}), so its distance to the nearest 0 is ${mat[nr][nc]}.`,
        vars: { nr, nc, distance: mat[nr][nc] },
        visuals: view([nr, nc]),
        tone: 'success',
      });
    }
  }

  r.step({
    at: 'return mat;',
    explain: 'BFS expands in rings, so the first value written to a cell is already the minimum distance.',
    visuals: [grid(mat, { title: 'mat' })],
    tone: 'success',
    result: `return ${JSON.stringify(mat)}`,
  });
}

/* ── Clone Graph ──────────────────────────────────────────────────────────── */

function cloneGraph(r: Recorder, adjacency: number[][]) {
  const n = adjacency.length;
  const nodes = Array.from({ length: n }, (_, i) => `${i + 1}`);
  const edges: GraphViz['edges'] = [];
  for (let i = 0; i < n; i++) for (const j of adjacency[i]) if (i < j - 1) edges.push({ from: nodes[i], to: nodes[j - 1] });

  const cloned = new Set<string>();
  const calls: string[] = [];

  const view = (active?: string, state: CellState = 'active'): Visual[] => [
    graphViz(
      nodes.map((id) => ({ id, label: id, state: id === active ? state : cloned.has(id) ? ('visited' as CellState) : undefined })),
      edges,
      { title: 'original graph' },
    ),
    graphViz(
      nodes.filter((id) => cloned.has(id)).map((id) => ({ id: `c${id}`, label: id, state: id === active ? 'success' : undefined })),
      edges.filter((e) => cloned.has(e.from) && cloned.has(e.to)).map((e) => ({ from: `c${e.from}`, to: `c${e.to}` })),
      { title: 'clone' },
    ),
    frames('call stack', calls.slice().reverse()),
  ];

  r.step({
    at: 'oldToNew.put(null, null);',
    explain:
      'The map from original node to clone does double duty: it stores the copies and remembers which nodes are already visited, which is what keeps cycles from looping forever.',
    visuals: view(),
  });

  const dfs = (id: string) => {
    if (cloned.has(id)) {
      r.step({
        at: ['if (oldToNew.containsKey(node)) {', 'return oldToNew.get(node);'],
        explain: `Node ${id} has been cloned already — return the existing copy instead of recursing again.`,
        vars: { node: id },
        visuals: view(id, 'done'),
      });
      return;
    }
    cloned.add(id);
    calls.push(`dfs(${id})`);
    r.step({
      at: ['GraphNode clone = new GraphNode(node.val);', 'oldToNew.put(node, clone);'],
      explain: `Create the copy of node ${id} and record it before touching its neighbours.`,
      vars: { node: id, cloned: cloned.size },
      visuals: view(id),
    });
    const i = Number(id) - 1;
    for (const nb of adjacency[i]) {
      r.step({
        at: 'clone.neighbors.add(dfs(n));',
        explain: `Clone neighbour ${nb} of node ${id}.`,
        vars: { node: id, neighbor: nb },
        visuals: view(`${nb}`, 'compare'),
      });
      dfs(`${nb}`);
    }
    calls.pop();
  };

  dfs('1');

  r.step({
    at: 'return oldToNew.get(node);',
    explain: 'Every node and edge exists twice now, with no references shared between the two graphs.',
    visuals: view(),
    tone: 'success',
    result: 'return clone of node 1',
  });
}

/* ── Course Schedule (I and II) ───────────────────────────────────────────── */

function courseSchedule(r: Recorder, numCourses: number, prerequisites: number[][], withOrder: boolean) {
  const adj: number[][] = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    adj[pre].push(course);
    indegree[course]++;
  }

  const ids = Array.from({ length: numCourses }, (_, i) => `${i}`);
  const edges: GraphViz['edges'] = prerequisites.map(([course, pre]) => ({ from: `${pre}`, to: `${course}`, directed: true }));
  const q: number[] = [];
  const res: number[] = [];
  let processed = 0;
  const done = new Set<number>();

  const view = (active?: number): Visual[] => [
    graphViz(
      ids.map((id, i) => ({
        id,
        label: id,
        state: i === active ? 'active' : done.has(i) ? ('done' as CellState) : q.includes(i) ? ('window' as CellState) : undefined,
        badge: `in ${indegree[i]}`,
      })),
      edges,
      { title: 'courses  (an arrow means "must come first")' },
    ),
    arr(indegree, {
      title: 'indegree  (unmet prerequisites per course)',
      states: indegree.map((v: number, i: number) => (i === active ? ('active' as CellState) : v === 0 && !done.has(i) ? ('success' as CellState) : undefined)),
    }),
    queue('queue  (courses with no prerequisites left)', q),
    ...(withOrder ? [arr(res, { title: 'res', states: res.map(() => 'success' as CellState) })] : []),
  ];

  r.step({
    at: ['adj.get(p[1]).add(p[0]);', withOrder ? 'indegrees[p[0]]++;' : 'indegree[p[0]]++;'],
    explain:
      "Kahn's algorithm: build the adjacency list and count, for every course, how many prerequisites it still needs.",
    vars: { numCourses, edges: prerequisites.length },
    visuals: view(),
  });

  for (let i = 0; i < numCourses; i++) {
    if (indegree[i] === 0) q.push(i);
  }
  r.step({
    at: withOrder ? 'if (indegrees[i] == 0) queue.add(i);' : 'if (indegree[i] == 0) {',
    explain: `Courses with indegree 0 can be taken right away: ${q.length ? q.join(', ') : 'none'}.`,
    vars: { queue: `[${q.join(', ')}]` },
    visuals: view(),
  });

  while (q.length > 0) {
    const course = q.shift()!;
    processed++;
    done.add(course);
    if (withOrder) res.push(course);
    r.step({
      at: withOrder ? ['int course = queue.poll();', 'res[i] = course;'] : ['int course = queue.poll();', 'processed++;'],
      explain: `Take course ${course}. ${withOrder ? `It is number ${res.length} in the order.` : `${processed} of ${numCourses} courses done.`}`,
      vars: { course, processed },
      visuals: view(course),
      tone: 'success',
    });

    for (const next of adj[course]) {
      indegree[next]--;
      if (indegree[next] === 0) q.push(next);
      r.step({
        at: withOrder ? ['indegrees[next]--;', 'if (indegrees[next] == 0) queue.add(next);'] : ['indegree[next]--;', 'if (indegree[next] == 0) {'],
        explain:
          indegree[next] === 0
            ? `Course ${next} has no unmet prerequisites left — it joins the queue.`
            : `Course ${next} still needs ${indegree[next]} more prerequisite(s).`,
        vars: { next, indegree: indegree[next] },
        visuals: view(next),
      });
    }
  }

  if (withOrder) {
    const ok = res.length === numCourses;
    r.step({
      at: 'return i == numCourses ? res : new int[]{};',
      explain: ok
        ? `All ${numCourses} courses were ordered, so the schedule is valid.`
        : 'The queue emptied before every course was taken, which means a cycle exists — no valid order.',
      vars: { i: res.length, numCourses },
      visuals: view(),
      tone: ok ? 'success' : 'error',
      result: ok ? `return [${res.join(', ')}]` : 'return []',
    });
    return;
  }

  const ok = processed === numCourses;
  r.step({
    at: 'return processed == numCourses;',
    explain: ok
      ? `Every course was processed, so the prerequisite graph has no cycle.`
      : `Only ${processed} of ${numCourses} courses could be processed — the rest sit in a cycle.`,
    vars: { processed, numCourses },
    visuals: view(),
    tone: ok ? 'success' : 'error',
    result: `return ${ok}`,
  });
}

/* ── Number of Connected Components (Union-Find) ──────────────────────────── */

function countComponents(r: Recorder, n: number, edges: number[][]) {
  const parents = Array.from({ length: n }, (_, i) => i);
  const sizes = new Array(n).fill(1);
  let components = n;

  const ids = Array.from({ length: n }, (_, i) => `${i}`);
  const graphEdges: GraphViz['edges'] = [];

  const find = (node: number): number => {
    if (node !== parents[node]) parents[node] = find(parents[node]);
    return parents[node];
  };

  const view = (a?: number, b?: number): Visual[] => [
    graphViz(
      ids.map((id, i) => ({
        id,
        label: id,
        state: i === a ? 'active' : i === b ? 'compare' : undefined,
        badge: `root ${find(i)}`,
      })),
      graphEdges,
      { title: 'graph', note: `components: ${components}` },
    ),
    arr(parents, { title: 'parents', states: parents.map((p: number, i: number) => (p !== i ? ('done' as CellState) : undefined)) }),
    arr(sizes, { title: 'sizes' }),
  ];

  r.step({
    at: ['parents[i] = i;', 'sizes[i] = 1;'],
    explain: `Union-Find starts with ${n} singleton sets: every node is its own root, so there are ${n} components.`,
    vars: { components },
    visuals: view(),
  });

  for (const [v, u] of edges) {
    graphEdges.push({ from: `${v}`, to: `${u}` });
    const pv = find(v);
    const pu = find(u);
    if (pv === pu) {
      r.step({
        at: 'if (pv == pu) return;',
        explain: `${v} and ${u} already share the root ${pv}, so this edge adds nothing — the component count stays ${components}.`,
        vars: { v, u, pv, pu, components },
        visuals: view(v, u),
        tone: 'warn',
      });
      continue;
    }
    if (sizes[pu] < sizes[pv]) {
      parents[pu] = pv;
      sizes[pv] += sizes[pu];
    } else {
      parents[pv] = pu;
      sizes[pu] += sizes[pv];
    }
    components--;
    r.step({
      at: ['if (sizes[pu] < sizes[pv]) {', 'this.components--;'],
      explain: `Union ${v} and ${u}: the smaller tree is attached under the larger root, which keeps the trees shallow. One less component → ${components}.`,
      vars: { v, u, pv, pu, components },
      visuals: view(v, u),
      tone: 'success',
    });
  }

  r.step({
    at: 'return dsu.getComponents();',
    explain: `Every edge has been merged; ${components} component(s) remain.`,
    vars: { components },
    visuals: view(),
    tone: 'success',
    result: `return ${components}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const graphTracers: Record<string, Tracer> = {
  'easy/graphs/FloodFill': {
    examples: [
      {
        label: 'image = [[1,1,1],[1,1,0],[1,0,1]], (1,1) → 2',
        input: 'image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2',
        run: (r) => floodFill(r, [[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2),
      },
      {
        label: 'colour already applied',
        input: 'image = [[0,0,0],[0,1,1]], sr = 1, sc = 1, color = 1',
        run: (r) => floodFill(r, [[0, 0, 0], [0, 1, 1]], 1, 1, 1),
      },
    ],
  },
  'medium/graphs/NumberOfIslands': {
    examples: [
      {
        label: 'three islands',
        input: 'grid = [["1","1","0","0"],["1","1","0","0"],["0","0","1","0"],["0","0","0","1"]]',
        run: (r) =>
          numIslands(r, [
            ['1', '1', '0', '0'],
            ['1', '1', '0', '0'],
            ['0', '0', '1', '0'],
            ['0', '0', '0', '1'],
          ]),
      },
      {
        label: 'one island',
        input: 'grid = [["1","1","1"],["0","1","0"],["1","1","1"]]',
        run: (r) =>
          numIslands(r, [
            ['1', '1', '1'],
            ['0', '1', '0'],
            ['1', '1', '1'],
          ]),
      },
    ],
  },
  'medium/graphs/MaxAreaOfIsland': {
    examples: [
      {
        label: 'grid with two islands',
        input: 'grid = [[0,1,1,0],[0,1,0,0],[0,0,0,1],[0,0,1,1]]',
        run: (r) => maxAreaOfIsland(r, [[0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 1]]),
      },
    ],
  },
  'medium/graphs/SurroundedRegions': {
    examples: [
      {
        label: 'classic 4×4 board',
        input: 'board = [["X","X","X","X"],["X","O","O","X"],["X","X","O","X"],["X","O","X","X"]]',
        run: (r) =>
          surroundedRegions(r, [
            ['X', 'X', 'X', 'X'],
            ['X', 'O', 'O', 'X'],
            ['X', 'X', 'O', 'X'],
            ['X', 'O', 'X', 'X'],
          ]),
      },
    ],
  },
  'medium/graphs/RottingOranges': {
    examples: [
      { label: 'all oranges rot', input: 'grid = [[2,1,1],[1,1,0],[0,1,1]]', run: (r) => orangesRotting(r, [[2, 1, 1], [1, 1, 0], [0, 1, 1]]) },
      { label: 'unreachable orange', input: 'grid = [[2,1,1],[0,1,1],[1,0,1]]', run: (r) => orangesRotting(r, [[2, 1, 1], [0, 1, 1], [1, 0, 1]]) },
    ],
  },
  'medium/graphs/IslandsAndTreasure': {
    examples: [
      {
        label: 'two treasures',
        input: 'grid = [[∞,-1,0,∞],[∞,∞,∞,-1],[∞,-1,∞,-1],[0,-1,∞,∞]]',
        run: (r) =>
          islandsAndTreasure(r, [
            [INF, -1, 0, INF],
            [INF, INF, INF, -1],
            [INF, -1, INF, -1],
            [0, -1, INF, INF],
          ]),
      },
    ],
  },
  'medium/graphs/ZeroOneMatrix': {
    examples: [
      { label: 'mat = [[0,0,0],[0,1,0],[1,1,1]]', input: 'mat = [[0,0,0],[0,1,0],[1,1,1]]', run: (r) => updateMatrix(r, [[0, 0, 0], [0, 1, 0], [1, 1, 1]]) },
      { label: 'mat = [[0,1,1],[1,1,1],[1,1,0]]', input: 'mat = [[0,1,1],[1,1,1],[1,1,0]]', run: (r) => updateMatrix(r, [[0, 1, 1], [1, 1, 1], [1, 1, 0]]) },
    ],
  },
  'medium/graphs/CloneGraph': {
    examples: [
      {
        label: 'square graph',
        input: 'adjList = [[2,4],[1,3],[2,4],[1,3]]',
        run: (r) => cloneGraph(r, [[2, 4], [1, 3], [2, 4], [1, 3]]),
      },
      { label: 'two nodes', input: 'adjList = [[2],[1]]', run: (r) => cloneGraph(r, [[2], [1]]) },
    ],
  },
  'medium/graphs/CourseSchedule': {
    examples: [
      { label: 'possible', input: 'numCourses = 4, prerequisites = [[1,0],[2,1],[3,2]]', run: (r) => courseSchedule(r, 4, [[1, 0], [2, 1], [3, 2]], false) },
      { label: 'cycle', input: 'numCourses = 3, prerequisites = [[1,0],[2,1],[0,2]]', run: (r) => courseSchedule(r, 3, [[1, 0], [2, 1], [0, 2]], false) },
    ],
  },
  'medium/graphs/CourseScheduleII': {
    examples: [
      { label: 'valid order', input: 'numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]', run: (r) => courseSchedule(r, 4, [[1, 0], [2, 0], [3, 1], [3, 2]], true) },
      { label: 'cycle', input: 'numCourses = 2, prerequisites = [[0,1],[1,0]]', run: (r) => courseSchedule(r, 2, [[0, 1], [1, 0]], true) },
    ],
  },
  'medium/graphs/NumberOfConnectedComponentsInUndirectedGraph': {
    examples: [
      { label: 'n = 5, two components', input: 'n = 5, edges = [[0,1],[1,2],[3,4]]', run: (r) => countComponents(r, 5, [[0, 1], [1, 2], [3, 4]]) },
      { label: 'redundant edge', input: 'n = 4, edges = [[0,1],[1,2],[0,2],[3,1]]', run: (r) => countComponents(r, 4, [[0, 1], [1, 2], [0, 2], [3, 1]]) },
    ],
  },
};
