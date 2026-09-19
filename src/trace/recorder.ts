import type { CellState, Step, Visual } from '../types';

export interface StepSpec {
  /**
   * Where we are in the Java source. Each entry is a snippet of the line —
   * matching on text rather than line numbers means the traces survive edits to
   * the Java repository. Use `'snippet' + '@2'` to target a later occurrence.
   */
  at?: string | string[];
  explain: string;
  vars?: Record<string, string | number | boolean | null | undefined>;
  visuals?: Visual[];
  tone?: Step['tone'];
  result?: string;
}

/**
 * Collects the steps of one replay and resolves Java source lines by content.
 */
export class Recorder {
  readonly codeLines: string[];
  readonly steps: Step[] = [];
  /** Snippets that did not match any line — surfaced by `npm run check`. */
  readonly unresolved: string[] = [];

  /** Visuals reused on every step unless a step overrides them. */
  private sticky: Visual[] = [];

  constructor(code: string) {
    this.codeLines = code.split('\n');
  }

  /** 1-based line number of the first line containing `snippet`, or 0. */
  at(snippet: string): number {
    let needle = snippet;
    let occurrence = 1;
    const m = snippet.match(/^(.*)@(\d+)$/);
    if (m) {
      needle = m[1];
      occurrence = Number(m[2]);
    }
    let seen = 0;
    for (let i = 0; i < this.codeLines.length; i++) {
      if (this.codeLines[i].includes(needle)) {
        seen++;
        if (seen === occurrence) return i + 1;
      }
    }
    this.unresolved.push(snippet);
    return 0;
  }

  /** Visuals to repeat on every following step that does not specify its own. */
  background(visuals: Visual[]): void {
    this.sticky = visuals;
  }

  step(spec: StepSpec): void {
    const at = spec.at === undefined ? [] : Array.isArray(spec.at) ? spec.at : [spec.at];
    this.steps.push({
      lines: at.map((s) => this.at(s)).filter((n) => n > 0),
      explain: spec.explain,
      vars: spec.vars,
      visuals: spec.visuals ?? this.sticky,
      tone: spec.tone,
      result: spec.result,
    });
  }
}

/** Builds a `states` array: `marks(5, { 2: 'active', 4: 'done' })`. */
export function marks(length: number, spec: Record<number, CellState | undefined>): (CellState | undefined)[] {
  const out: (CellState | undefined)[] = new Array(length).fill(undefined);
  for (const [k, v] of Object.entries(spec)) {
    const i = Number(k);
    if (i >= 0 && i < length) out[i] = v;
  }
  return out;
}

/** Marks every index in `[from, to]` with `state`, leaving the rest untouched. */
export function range(
  states: (CellState | undefined)[],
  from: number,
  to: number,
  state: CellState,
): (CellState | undefined)[] {
  const out = states.slice();
  for (let i = Math.max(0, from); i <= Math.min(states.length - 1, to); i++) out[i] = state;
  return out;
}

/** A 2D `states` grid filled with `fill`. */
export function gridStates(rows: number, cols: number, fill?: CellState): (CellState | undefined)[][] {
  return Array.from({ length: rows }, () => new Array<CellState | undefined>(cols).fill(fill));
}

/** `[1,2,3]` -> `"[1, 2, 3]"`, for the variables panel. */
export function fmt(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(fmt).join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
