import type { Recorder } from '../trace/recorder';
import type { CellState, IntervalsViz, Tracer, Visual } from '../types';
import { intervalsViz } from './helpers';

type Iv = [number, number];

const fmt = (iv: Iv) => `[${iv[0]}, ${iv[1]}]`;

/** One interval per row keeps overlaps readable. */
function rows(list: Iv[], state: (i: number) => CellState | undefined, title: string, extra?: IntervalsViz['intervals']): Visual {
  const max = Math.max(...list.flat(), ...(extra ?? []).map((e) => e.end), 1);
  return intervalsViz(
    title,
    [
      ...list.map((iv, i) => ({ start: iv[0], end: iv[1], label: fmt(iv), state: state(i), row: i })),
      ...(extra ?? []).map((e, k) => ({ ...e, row: list.length + k })),
    ],
    { min: 0, max },
  );
}

/* ── Meeting Rooms ────────────────────────────────────────────────────────── */

function canAttendMeetings(r: Recorder, input: Iv[]) {
  const intervals = input.slice().sort((a, b) => a[0] - b[0]);

  r.step({
    at: 'intervals.sort((a, b) -> Integer.compare(a.start, b.start));',
    explain: `Sort by start time — ${input.map(fmt).join(', ')} → ${intervals.map(fmt).join(', ')}. After that, only neighbouring pairs can clash.`,
    visuals: [rows(intervals, () => undefined, 'intervals (sorted by start)')],
  });

  for (let i = 0; i < intervals.length - 1; i++) {
    const i1 = intervals[i];
    const i2 = intervals[i + 1];
    const clash = i2[0] < i1[1];
    r.step({
      at: ['Interval i2 = intervals.get(i + 1);', 'if (i2.start < i1.end) return false;'],
      explain: clash
        ? `Meeting ${fmt(i2)} starts at ${i2[0]}, before ${fmt(i1)} ends at ${i1[1]} — they overlap.`
        : `${fmt(i2)} starts at ${i2[0]}, after ${fmt(i1)} ends at ${i1[1]} — no clash.`,
      vars: { i, 'i1.end': i1[1], 'i2.start': i2[0] },
      visuals: [
        rows(intervals, (k) => (k === i ? (clash ? 'error' : 'active') : k === i + 1 ? (clash ? 'error' : 'compare') : undefined), 'intervals (sorted by start)'),
      ],
      tone: clash ? 'error' : 'neutral',
    });
    if (clash) {
      r.step({
        at: 'if (i2.start < i1.end) return false;',
        explain: 'One person cannot attend two overlapping meetings.',
        visuals: [rows(intervals, (k) => (k === i || k === i + 1 ? 'error' : 'muted'), 'intervals')],
        tone: 'error',
        result: 'return false',
      });
      return;
    }
  }

  r.step({
    at: 'return true;',
    explain: 'No neighbouring pair overlaps, so every meeting can be attended.',
    visuals: [rows(intervals, () => 'success', 'intervals')],
    tone: 'success',
    result: 'return true',
  });
}

/* ── Insert Interval ──────────────────────────────────────────────────────── */

function insertInterval(r: Recorder, intervals: Iv[], newIntervalInput: Iv) {
  let newInterval: Iv | null = [...newIntervalInput] as Iv;
  const res: Iv[] = [];

  const view = (i: number, state: CellState): Visual[] => [
    rows(
      intervals,
      (k) => (k === i ? state : k < i ? ('muted' as CellState) : undefined),
      'intervals (already sorted)',
      newInterval ? [{ start: newInterval[0], end: newInterval[1], label: `new ${fmt(newInterval)}`, state: 'compare' }] : [],
    ),
    rows(res, () => 'success', 'res'),
  ];

  r.step({
    at: 'List<int[]> res = new ArrayList<>();',
    explain: `Walk the sorted intervals once. Each one either ends before ${fmt(newIntervalInput)}, starts after it, or overlaps and gets absorbed into it.`,
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    if (newInterval === null || interval[1] < newInterval[0]) {
      res.push(interval);
      r.step({
        at: ['if (newInterval == null || interval[1] < newInterval[0]) {', 'res.add(interval);@1'],
        explain:
          newInterval === null
            ? `${fmt(interval)} comes after the merge window closed — copy it straight through.`
            : `${fmt(interval)} ends at ${interval[1]}, before the new interval starts at ${newInterval[0]} — no overlap possible, keep it as is.`,
        vars: { i, interval: fmt(interval) },
        visuals: view(i, 'visited'),
      });
    } else if (interval[0] > newInterval[1]) {
      res.push(newInterval, interval);
      r.step({
        at: ['} else if (interval[0] > newInterval[1]) {', 'res.add(newInterval);@1', 'newInterval = null;'],
        explain: `${fmt(interval)} starts at ${interval[0]}, after the new interval ends at ${newInterval[1]}. The merge window is closed: place the new interval first, then this one.`,
        vars: { i, inserted: fmt(newInterval) },
        visuals: [rows(intervals, (k) => (k === i ? 'active' : k < i ? ('muted' as CellState) : undefined), 'intervals'), rows(res, () => 'success', 'res')],
        tone: 'success',
      });
      newInterval = null;
    } else {
      const merged: Iv = [Math.min(interval[0], newInterval[0]), Math.max(interval[1], newInterval[1])];
      r.step({
        at: ['newInterval[0] = Math.min(interval[0], newInterval[0]);', 'newInterval[1] = Math.max(interval[1], newInterval[1]);'],
        explain: `${fmt(interval)} overlaps the new interval — widen it to ${fmt(merged)} and keep going.`,
        vars: { i, interval: fmt(interval), newInterval: fmt(merged) },
        visuals: view(i, 'compare'),
        tone: 'warn',
      });
      newInterval = merged;
    }
  }

  if (newInterval !== null) {
    res.push(newInterval);
    r.step({
      at: 'if (newInterval != null) res.add(newInterval);',
      explain: `The new interval never got placed inside the loop (it extends past every existing interval), so append it now.`,
      visuals: [rows(res, () => 'success', 'res')],
    });
  }

  r.step({
    at: 'return res.toArray(new int[res.size()][]);',
    explain: 'The result stays sorted and non-overlapping.',
    visuals: [rows(res, () => 'success', 'res')],
    tone: 'success',
    result: `return [${res.map(fmt).join(', ')}]`,
  });
}

/* ── Merge Intervals ──────────────────────────────────────────────────────── */

function mergeIntervals(r: Recorder, input: Iv[]) {
  const intervals = input.map((iv) => [...iv] as Iv).sort((a, b) => a[0] - b[0]);
  let merged: Iv = intervals[0];
  const res: Iv[] = [];

  const view = (i: number, state: CellState): Visual[] => [
    rows(intervals, (k) => (k === i + 1 ? state : undefined), 'intervals (sorted by start)', [
      { start: merged[0], end: merged[1], label: `merged ${fmt(merged)}`, state: 'active' },
    ]),
    rows(res, () => 'success', 'res'),
  ];

  r.step({
    at: ['Arrays.sort(intervals, (a, b) -> a[0] - b[0]);', 'int[] mergedInterval = intervals[0];'],
    explain: `Sorting by start (${intervals.map(fmt).join(', ')}) means an interval can only ever overlap the one currently being built.`,
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < intervals.length - 1; i++) {
    const next = intervals[i + 1];
    if (merged[1] < next[0]) {
      res.push(merged);
      r.step({
        at: ['if (mergedInterval[1] < intervals[i + 1][0]) {', 'res.add(mergedInterval);@1', 'mergedInterval = intervals[i + 1];'],
        explain: `${fmt(merged)} ends at ${merged[1]}, before ${fmt(next)} starts at ${next[0]} — nothing can extend it any more, so flush it and start a new one.`,
        vars: { i, flushed: fmt(merged), next: fmt(next) },
        visuals: view(i, 'compare'),
        tone: 'success',
      });
      merged = next;
    } else {
      const end = Math.max(merged[1], next[1]);
      r.step({
        at: 'mergedInterval[1] = Math.max(mergedInterval[1], intervals[i + 1][1]);',
        explain: `${fmt(next)} starts at ${next[0]}, inside ${fmt(merged)} — absorb it by stretching the end to ${end}.`,
        vars: { i, merged: `[${merged[0]}, ${end}]` },
        visuals: view(i, 'window'),
        tone: 'warn',
      });
      merged = [merged[0], end];
    }
  }

  res.push(merged);
  r.step({
    at: ['res.add(mergedInterval);@2', 'return res.toArray(new int[res.size()][]);'],
    explain: 'The interval still being built at the end also belongs to the answer.',
    visuals: [rows(res, () => 'success', 'res')],
    tone: 'success',
    result: `return [${res.map(fmt).join(', ')}]`,
  });
}

/* ── Non-overlapping Intervals ────────────────────────────────────────────── */

function eraseOverlapIntervals(r: Recorder, input: Iv[]) {
  const intervals = input.map((iv) => [...iv] as Iv).sort((a, b) => a[0] - b[0]);
  let lastEnd = intervals[0][1];
  let res = 0;
  const removed = new Set<number>();

  const view = (i: number, state: CellState): Visual[] => [
    rows(
      intervals,
      (k) => (removed.has(k) ? 'error' : k === i + 1 ? state : k <= i ? ('done' as CellState) : undefined),
      `intervals (sorted by start) · lastEnd = ${lastEnd}`,
    ),
  ];

  r.step({
    at: ['Arrays.sort(intervals, (a, b) -> a[0] - b[0]);', 'int lastEnd = intervals[0][1];'],
    explain:
      'Greedy rule: when two intervals overlap, remove the one that ends later — it blocks more of what follows, and keeping the earlier end can never be worse.',
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < intervals.length - 1; i++) {
    const next = intervals[i + 1];
    if (next[0] < lastEnd) {
      res++;
      const keptEnd = Math.min(lastEnd, next[1]);
      removed.add(keptEnd === next[1] ? i : i + 1);
      r.step({
        at: ['if (intervals[i + 1][0] < lastEnd) {', 'res++;', 'lastEnd = Math.min(lastEnd, intervals[i + 1][1]);'],
        explain: `${fmt(next)} starts at ${next[0]}, before lastEnd = ${lastEnd} — they overlap. Remove one of them (${res} so far) and keep the earlier end, ${keptEnd}.`,
        vars: { i, 'intervals[i+1]': fmt(next), lastEnd: keptEnd, res },
        visuals: [
          rows(
            intervals,
            (k) => (removed.has(k) ? 'error' : k === i + 1 ? 'compare' : k <= i ? ('done' as CellState) : undefined),
            `intervals · lastEnd = ${keptEnd}`,
          ),
        ],
        tone: 'warn',
      });
      lastEnd = keptEnd;
    } else {
      lastEnd = Math.max(lastEnd, next[1]);
      r.step({
        at: ['} else {', 'lastEnd = Math.max(lastEnd, intervals[i + 1][1]);'],
        explain: `${fmt(next)} starts at ${next[0]}, at or after lastEnd — no overlap, so keep it and move lastEnd to ${lastEnd}.`,
        vars: { i, lastEnd, res },
        visuals: view(i, 'success'),
      });
    }
  }

  r.step({
    at: 'return res;',
    explain: `Removing ${res} interval(s) leaves a non-overlapping set.`,
    vars: { res },
    visuals: view(intervals.length, 'idle'),
    tone: 'success',
    result: `return ${res}`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const intervalTracers: Record<string, Tracer> = {
  'easy/intervals/MeetingRooms': {
    examples: [
      { label: 'overlapping', input: 'intervals = [(0,30), (5,10), (15,20)]', run: (r) => canAttendMeetings(r, [[0, 30], [5, 10], [15, 20]]) },
      { label: 'no overlap', input: 'intervals = [(5,8), (9,15)]', run: (r) => canAttendMeetings(r, [[5, 8], [9, 15]]) },
    ],
  },
  'medium/intervals/InsertInterval': {
    examples: [
      { label: 'merging in the middle', input: 'intervals = [[1,3],[6,9]], newInterval = [2,5]', run: (r) => insertInterval(r, [[1, 3], [6, 9]], [2, 5]) },
      {
        label: 'swallowing several',
        input: 'intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]',
        run: (r) => insertInterval(r, [[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]),
      },
    ],
  },
  'medium/intervals/MergeIntervals': {
    examples: [
      { label: '[[1,3],[2,6],[8,10],[15,18]]', input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', run: (r) => mergeIntervals(r, [[1, 3], [2, 6], [8, 10], [15, 18]]) },
      { label: 'unsorted input', input: 'intervals = [[5,7],[1,4],[2,3]]', run: (r) => mergeIntervals(r, [[5, 7], [1, 4], [2, 3]]) },
    ],
  },
  'medium/intervals/NonOverlappingIntervals': {
    examples: [
      { label: '[[1,2],[2,3],[3,4],[1,3]]', input: 'intervals = [[1,2],[2,3],[3,4],[1,3]]', run: (r) => eraseOverlapIntervals(r, [[1, 2], [2, 3], [3, 4], [1, 3]]) },
      { label: '[[1,2],[1,3],[1,4]]', input: 'intervals = [[1,2],[1,3],[1,4]]', run: (r) => eraseOverlapIntervals(r, [[1, 2], [1, 3], [1, 4]]) },
    ],
  },
};
