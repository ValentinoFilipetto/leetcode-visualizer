import type { Recorder } from '../trace/recorder';
import type { CellState, GraphViz, Tracer, Visual } from '../types';
import { arr, chars, frames, graphViz } from './helpers';

/* ── A trie the tracers can grow and walk ─────────────────────────────────── */

interface TrieNode {
  id: string;
  char: string;
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
}

let uid = 0;
const newNode = (char: string): TrieNode => ({ id: `tn${uid++}`, char, children: new Map(), isEndOfWord: false });

/**
 * Lays the trie out by depth (y) and left-to-right visit order (x), which the
 * graph renderer accepts as normalized `given` coordinates.
 */
function trieViz(root: TrieNode, states: Record<string, CellState> = {}, title = 'trie'): Visual {
  const nodes: GraphViz['nodes'] = [];
  const edges: GraphViz['edges'] = [];
  let leafOrder = 0;
  let maxDepth = 0;

  const place = (node: TrieNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = [...node.children.values()];
    let x: number;
    if (kids.length === 0) {
      x = leafOrder++;
    } else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    nodes.push({
      id: node.id,
      label: node.char === '' ? '·' : node.isEndOfWord ? `${node.char}●` : node.char,
      state: states[node.id],
      x,
      y: depth,
    });
    for (const k of kids) edges.push({ from: node.id, to: k.id, directed: true });
    return x;
  };

  place(root, 0);
  const width = Math.max(1, leafOrder - 1);
  for (const n of nodes) {
    n.x = width === 0 ? 0.5 : (n.x as number) / width;
    n.y = maxDepth === 0 ? 0.5 : (n.y as number) / maxDepth;
  }

  return graphViz(nodes, edges, { layout: 'given', title, note: '● marks the end of a word' });
}

/* ── Implement Trie ───────────────────────────────────────────────────────── */

type TrieOp = ['insert', string] | ['search', string] | ['startsWith', string];

function implementTrie(r: Recorder, ops: TrieOp[]) {
  const root = newNode('');

  r.step({
    at: 'this.root = new TrieNode();',
    explain: 'A trie stores words by their letters: shared prefixes share nodes, so lookups cost only the length of the word.',
    visuals: [trieViz(root)],
  });

  for (const op of ops) {
    const word = op[1];
    let curr = root;
    const path: string[] = [root.id];

    if (op[0] === 'insert') {
      for (let i = 0; i < word.length; i++) {
        const c = word[i];
        const existed = curr.children.has(c);
        if (!existed) curr.children.set(c, newNode(c));
        curr = curr.children.get(c)!;
        path.push(curr.id);
        r.step({
          at: ['curr.children.putIfAbsent(c, new TrieNode());', 'curr = curr.children.get(c);'],
          explain: existed
            ? `insert("${word}"): '${c}' already exists, so the prefix is shared — just walk into it.`
            : `insert("${word}"): '${c}' is new, so create a node for it.`,
          vars: { word, c, i },
          visuals: [
            trieViz(root, Object.fromEntries(path.map((id, k) => [id, k === path.length - 1 ? (existed ? 'active' : 'success') : ('visited' as CellState)]))),
            arr(chars(word), { title: 'word', states: chars(word).map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
          ],
          tone: existed ? 'neutral' : 'success',
        });
      }
      curr.isEndOfWord = true;
      r.step({
        at: 'curr.isEndOfWord = true;',
        explain: `Mark the last node as the end of "${word}". Without this flag, "app" and "apple" could not be told apart.`,
        vars: { word },
        visuals: [trieViz(root, { [curr.id]: 'success' })],
        tone: 'success',
      });
      continue;
    }

    // search / startsWith share the same walk
    let failed = false;
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      const next = curr.children.get(c);
      if (!next) {
        failed = true;
        r.step({
          at: op[0] === 'search' ? '} else return false;' : '} else return false;@2',
          explain: `${op[0]}("${word}"): there is no '${c}' edge here, so the ${op[0] === 'search' ? 'word' : 'prefix'} is not in the trie.`,
          vars: { word, c, i },
          visuals: [
            trieViz(root, { [curr.id]: 'error' }),
            arr(chars(word), { title: op[0] === 'search' ? 'word' : 'prefix', states: chars(word).map((_, k) => (k === i ? ('error' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
          ],
          tone: 'error',
          result: `${op[0]}("${word}") = false`,
        });
        break;
      }
      curr = next;
      path.push(curr.id);
      r.step({
        at: op[0] === 'search' ? 'if (curr.children.containsKey(c)) {' : 'if (curr.children.containsKey(c)) {@2',
        explain: `${op[0]}("${word}"): follow the '${c}' edge.`,
        vars: { word, c, i },
        visuals: [
          trieViz(root, Object.fromEntries(path.map((id, k) => [id, k === path.length - 1 ? ('active' as CellState) : ('visited' as CellState)]))),
          arr(chars(word), { title: op[0] === 'search' ? 'word' : 'prefix', states: chars(word).map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
        ],
      });
    }
    if (failed) continue;

    if (op[0] === 'search') {
      r.step({
        at: 'return curr.isEndOfWord;',
        explain: curr.isEndOfWord
          ? `All letters matched and the final node is marked as a word end, so "${word}" was inserted.`
          : `All letters matched, but the final node is not a word end — "${word}" is only a prefix of something longer.`,
        vars: { word, isEndOfWord: curr.isEndOfWord },
        visuals: [trieViz(root, { [curr.id]: curr.isEndOfWord ? 'success' : 'error' })],
        tone: curr.isEndOfWord ? 'success' : 'error',
        result: `search("${word}") = ${curr.isEndOfWord}`,
      });
    } else {
      r.step({
        at: 'return true;',
        explain: `Every letter of "${word}" had an edge, so at least one stored word starts with it — no end-of-word flag needed here.`,
        vars: { prefix: word },
        visuals: [trieViz(root, { [curr.id]: 'success' })],
        tone: 'success',
        result: `startsWith("${word}") = true`,
      });
    }
  }
}

/* ── Add and Search Word (with '.' wildcard) ──────────────────────────────── */

type WordOp = ['add', string] | ['search', string];

function addAndSearch(r: Recorder, ops: WordOp[]) {
  const root = newNode('');
  const calls: string[] = [];

  r.step({
    at: 'root = new TrieNode();',
    explain: 'Same trie as before, except search may contain "." — a wildcard that matches any single character, which turns the lookup into a small DFS.',
    visuals: [trieViz(root)],
  });

  for (const op of ops) {
    const word = op[1];
    if (op[0] === 'add') {
      let curr = root;
      for (const c of word) {
        if (!curr.children.has(c)) curr.children.set(c, newNode(c));
        curr = curr.children.get(c)!;
      }
      curr.isEndOfWord = true;
      r.step({
        at: ['curr.children.putIfAbsent(c, new TrieNode());', 'curr.isEndOfWord = true;'],
        explain: `addWord("${word}") walks the letters, creating nodes where needed, and flags the last one.`,
        vars: { word },
        visuals: [trieViz(root, { [curr.id]: 'success' })],
      });
      continue;
    }

    const dfs = (i: number, curr: TrieNode): boolean => {
      if (i === word.length) {
        r.step({
          at: 'if (i == word.length()) return curr.isEndOfWord;',
          explain: curr.isEndOfWord
            ? `The whole pattern is consumed and this node ends a word — match.`
            : `The pattern is consumed but this node does not end a word — no match on this path.`,
          vars: { i, isEndOfWord: curr.isEndOfWord },
          visuals: [trieViz(root, { [curr.id]: curr.isEndOfWord ? 'success' : 'error' }), frames('call stack', calls.slice().reverse())],
          tone: curr.isEndOfWord ? 'success' : 'warn',
        });
        return curr.isEndOfWord;
      }

      const c = word[i];
      calls.push(`dfs(i=${i}, '${c}')`);
      if (c !== '.') {
        const next = curr.children.get(c);
        if (!next) {
          r.step({
            at: ['if (next == null) return false;'],
            explain: `No '${c}' edge from here — this path fails.`,
            vars: { i, currentChar: c },
            visuals: [
              trieViz(root, { [curr.id]: 'error' }),
              arr(chars(word), { title: 'word', states: chars(word).map((_, k) => (k === i ? ('error' as CellState) : undefined)) }),
              frames('call stack', calls.slice().reverse()),
            ],
            tone: 'warn',
          });
          calls.pop();
          return false;
        }
        r.step({
          at: 'return dfs(word, i + 1, next);',
          explain: `'${c}' is a normal character, so there is exactly one edge to follow.`,
          vars: { i, currentChar: c },
          visuals: [
            trieViz(root, { [next.id]: 'active', [curr.id]: 'visited' }),
            arr(chars(word), { title: 'word', states: chars(word).map((_, k) => (k === i ? ('active' as CellState) : k < i ? ('visited' as CellState) : undefined)) }),
            frames('call stack', calls.slice().reverse()),
          ],
        });
        const out = dfs(i + 1, next);
        calls.pop();
        return out;
      }

      r.step({
        at: 'for (TrieNode child : curr.children.values()) {',
        explain: `'.' matches anything, so every one of the ${curr.children.size} child branch(es) has to be tried until one succeeds.`,
        vars: { i, branches: curr.children.size },
        visuals: [
          trieViz(root, Object.fromEntries([...curr.children.values()].map((k) => [k.id, 'compare' as CellState]))),
          arr(chars(word), { title: 'word', states: chars(word).map((_, k) => (k === i ? ('compare' as CellState) : undefined)) }),
          frames('call stack', calls.slice().reverse()),
        ],
        tone: 'warn',
      });

      for (const child of curr.children.values()) {
        r.step({
          at: 'if (dfs(word, i + 1, child)) {',
          explain: `Try the wildcard as '${child.char}'.`,
          vars: { i, branch: child.char },
          visuals: [trieViz(root, { [child.id]: 'active' }), frames('call stack', calls.slice().reverse())],
        });
        if (dfs(i + 1, child)) {
          calls.pop();
          return true;
        }
      }
      calls.pop();
      return false;
    };

    const found = dfs(0, root);
    r.step({
      at: found ? 'return dfs(word, 0, this.root);' : 'return false;',
      explain: found ? `"${word}" matches a stored word.` : `No stored word matches "${word}".`,
      vars: { word },
      visuals: [trieViz(root)],
      tone: found ? 'success' : 'error',
      result: `search("${word}") = ${found}`,
    });
  }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const trieTracers: Record<string, Tracer> = {
  'medium/tries/ImplementTrie': {
    examples: [
      {
        label: 'insert / search / startsWith',
        input: 'insert("apple"), search("apple"), search("app"), startsWith("app"), insert("app"), search("app")',
        run: (r) =>
          implementTrie(r, [
            ['insert', 'apple'],
            ['search', 'apple'],
            ['search', 'app'],
            ['startsWith', 'app'],
            ['insert', 'app'],
            ['search', 'app'],
          ]),
      },
      {
        label: 'missing word',
        input: 'insert("car"), insert("cat"), search("cab"), startsWith("ca")',
        run: (r) =>
          implementTrie(r, [
            ['insert', 'car'],
            ['insert', 'cat'],
            ['search', 'cab'],
            ['startsWith', 'ca'],
          ]),
      },
    ],
  },
  'medium/tries/DesignAddAndSearchWordDataStructure': {
    examples: [
      {
        label: 'wildcards',
        input: 'addWord("bad"), addWord("dad"), addWord("mad"), search("pad"), search(".ad"), search("b..")',
        run: (r) =>
          addAndSearch(r, [
            ['add', 'bad'],
            ['add', 'dad'],
            ['add', 'mad'],
            ['search', 'pad'],
            ['search', '.ad'],
            ['search', 'b..'],
          ]),
      },
    ],
  },
};
