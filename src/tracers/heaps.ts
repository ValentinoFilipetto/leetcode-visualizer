import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, chars, chips, heap, intervalsViz, list, mapOf } from './helpers';

/**
 * A textbook binary heap, so the array layout shown in the visuals matches what
 * Java's PriorityQueue actually keeps in memory (sift-up on offer, sift-down on poll).
 */
class BinaryHeap<T> {
  readonly items: T[] = [];
  constructor(private readonly cmp: (a: T, b: T) => number) {}

  get size() {
    return this.items.length;
  }

  peek(): T {
    return this.items[0];
  }

  offer(value: T) {
    this.items.push(value);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.items[i], this.items[parent]) >= 0) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  poll(): T {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const rr = 2 * i + 2;
        let best = i;
        if (l < this.items.length && this.cmp(this.items[l], this.items[best]) < 0) best = l;
        if (rr < this.items.length && this.cmp(this.items[rr], this.items[best]) < 0) best = rr;
        if (best === i) break;
        [this.items[i], this.items[best]] = [this.items[best], this.items[i]];
        i = best;
      }
    }
    return top;
  }
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th" … used in the explanations. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Java's String.hashCode(), with the same 32-bit overflow. */
function javaStringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * The order a java.util.HashMap iterates its keys in (bucket by spread hash, then
 * insertion order within a bucket), so heaps fed from entrySet() get offered the
 * same sequence as in Java. `keys` must be in first-insertion order.
 */
function javaHashMapOrder<K>(keys: K[], hash: (k: K) => number): K[] {
  let cap = 16;
  while (keys.length > cap * 0.75) cap *= 2;
  const bucket = (k: K) => {
    const h = hash(k);
    return (h ^ (h >>> 16)) & (cap - 1);
  };
  return keys
    .map((k, i) => ({ k, i, b: bucket(k) }))
    .sort((x, y) => x.b - y.b || x.i - y.i)
    .map((x) => x.k);
}

/** Java String.compareTo: lexicographic by UTF-16 code unit, same as JS < on strings. */
const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const minHeap = () => new BinaryHeap<number>((a, b) => a - b);
const maxHeap = () => new BinaryHeap<number>((a, b) => b - a);

/* ── Kth Largest Element in an Array ──────────────────────────────────────── */

function findKthLargest(r: Recorder, nums: number[], k: number) {
  const h = minHeap();
  const view = (i: number, state: CellState, heapState?: CellState): Visual[] => [
    arr(nums, {
      title: 'nums',
      states: nums.map((_, x) => (x === i ? state : x < i ? ('visited' as CellState) : undefined)),
      pointers: i >= 0 && i < nums.length ? [{ name: 'num', index: i }] : [],
    }),
    heap(`minHeap  (holds the ${k} largest values seen so far)`, h.items, 'min', {
      states: h.items.map((_, x) => (x === 0 ? heapState : undefined)),
    }),
  ];

  r.step({
    at: 'PriorityQueue<Integer> minHeap = new PriorityQueue<>();',
    explain: `Keep a min-heap of size ${k}. Its smallest element is the ${ordinal(k)} largest seen so far, and anything smaller can be thrown away immediately.`,
    vars: { k },
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < nums.length; i++) {
    h.offer(nums[i]);
    r.step({
      at: 'minHeap.offer(num);',
      explain: `Push ${nums[i]}; it sifts up to its place, so the smallest value is always at index 0.`,
      vars: { num: nums[i], size: h.size, k },
      visuals: view(i, 'active', 'window'),
    });

    if (h.size > k) {
      const removed = h.poll();
      r.step({
        at: ['if (minHeap.size() > k)', 'minHeap.poll();'],
        explain: `The heap holds ${k + 1} values, so the smallest one (${removed}) can never be the ${ordinal(k)} largest — drop it.`,
        vars: { removed, size: h.size },
        visuals: view(i, 'visited', 'error'),
        tone: 'warn',
      });
    }
  }

  r.step({
    at: 'return minHeap.peek();',
    explain: `Exactly ${k} values remain — the ${k} largest. The smallest of them, ${h.peek()}, is the ${ordinal(k)} largest overall.`,
    vars: { answer: h.peek() },
    visuals: view(-1, 'idle', 'success'),
    tone: 'success',
    result: `return ${h.peek()}`,
  });
}

/* ── Kth Largest Element in a Stream ──────────────────────────────────────── */

function kthLargestStream(r: Recorder, k: number, nums: number[], adds: number[]) {
  const h = minHeap();
  const view = (state?: CellState): Visual[] => [
    heap(`minHeap  (size ≤ k = ${k})`, h.items, 'min', { states: h.items.map((_, i) => (i === 0 ? state : undefined)) }),
  ];

  r.step({
    at: 'this.minHeap = new PriorityQueue<>();',
    explain: `The constructor pours ${list(nums)} into a min-heap that never grows beyond k = ${k}.`,
    vars: { k },
    visuals: view(),
  });

  for (const num of nums) {
    h.offer(num);
    let removed: number | null = null;
    if (h.size > k) removed = h.poll();
    r.step({
      at: ['minHeap.offer(num);', 'if (minHeap.size() > k) minHeap.poll();@1'],
      explain: removed === null ? `Add ${num}; the heap is not full yet.` : `Add ${num}, then evict the smallest value ${removed} to stay at size ${k}.`,
      vars: { num, size: h.size },
      visuals: view(removed === null ? 'window' : 'error'),
    });
  }

  for (const val of adds) {
    h.offer(val);
    let removed: number | null = null;
    if (h.size > k) removed = h.poll();
    r.step({
      at: ['minHeap.offer(val);', 'if (minHeap.size() > k) minHeap.poll();@2', 'return minHeap.peek();'],
      explain: `add(${val}): push it, ${removed === null ? 'the heap still fits' : `evict ${removed}`}, then the root is the ${ordinal(k)} largest of the whole stream.`,
      vars: { val, removed: removed ?? '—', answer: h.peek() },
      visuals: view('success'),
      tone: 'success',
      result: `add(${val}) = ${h.peek()}`,
    });
  }
}

/* ── Last Stone Weight ────────────────────────────────────────────────────── */

function lastStoneWeight(r: Recorder, stones: number[]) {
  const h = maxHeap();
  const view = (states: Record<number, CellState> = {}): Visual[] => [
    heap('maxHeap', h.items, 'max', { states: h.items.map((_, i) => states[i]) }),
  ];

  r.step({
    at: 'PriorityQueue<Integer> maxHeap =',
    explain: 'A max-heap (reverse comparator) always hands back the two heaviest stones in O(log n).',
    visuals: [arr(stones, { title: 'stones' })],
  });

  for (const stone of stones) h.offer(stone);
  r.step({
    at: 'for (int stone : stones) maxHeap.add(stone);',
    explain: `All ${stones.length} stones are in the heap; the heaviest sits at the root.`,
    visuals: view({ 0: 'active' }),
  });

  while (h.size > 1) {
    const x = h.poll();
    const y = h.poll();
    if (x > y) {
      h.offer(x - y);
      r.step({
        at: ['int x = maxHeap.poll();', 'int y = maxHeap.poll();', 'if (x > y) maxHeap.offer(x - y);'],
        explain: `Smash ${x} against ${y}: the difference ${x - y} goes back into the heap.`,
        vars: { x, y, pushed: x - y, size: h.size },
        visuals: view({ 0: 'success' }),
        tone: 'success',
      });
    } else {
      r.step({
        at: ['int x = maxHeap.poll();', 'int y = maxHeap.poll();'],
        explain: `Smash ${x} against ${y}: equal weights, so both stones are destroyed.`,
        vars: { x, y, size: h.size },
        visuals: view(),
        tone: 'warn',
      });
    }
  }

  r.step({
    at: 'return maxHeap.isEmpty() ? 0 : maxHeap.peek();',
    explain: h.size === 0 ? 'Every stone was destroyed.' : `One stone of weight ${h.peek()} is left.`,
    visuals: view({ 0: 'success' }),
    tone: 'success',
    result: `return ${h.size === 0 ? 0 : h.peek()}`,
  });
}

/* ── K Closest Points to Origin ───────────────────────────────────────────── */

function kClosest(r: Recorder, points: number[][], k: number) {
  const dist = (p: number[]) => p[0] * p[0] + p[1] * p[1];
  const h = new BinaryHeap<number[]>((a, b) => dist(b) - dist(a)); // max-heap by distance
  const fmtPoint = (p: number[]) => `(${p[0]},${p[1]}) d²${dist(p)}`;

  const view = (i: number, state: CellState, rootState?: CellState): Visual[] => [
    arr(points.map((p) => `(${p[0]},${p[1]})`), {
      title: 'points',
      labels: points.map((p) => `d² ${dist(p)}`),
      indexed: false,
      states: points.map((_, x) => (x === i ? state : x < i ? ('visited' as CellState) : undefined)),
    }),
    heap(`maxHeap  (the ${k} closest points, farthest on top)`, h.items.map(fmtPoint), 'max', {
      states: h.items.map((_, x) => (x === 0 ? rootState : undefined)),
    }),
  ];

  r.step({
    at: 'PriorityQueue<int[]> maxHeap = new PriorityQueue<>(',
    explain:
      'Ordering by x² + y² avoids the square root entirely — comparing squared distances gives the same order. The max-heap keeps the worst of the best k at the root, ready to be evicted.',
    vars: { k },
    visuals: view(-1, 'idle'),
  });

  for (let i = 0; i < points.length; i++) {
    h.offer(points[i]);
    r.step({
      at: 'maxHeap.offer(point);',
      explain: `Offer (${points[i][0]}, ${points[i][1]}) with squared distance ${dist(points[i])}.`,
      vars: { point: `(${points[i][0]}, ${points[i][1]})`, 'd²': dist(points[i]), size: h.size },
      visuals: view(i, 'active', 'window'),
    });
    if (h.size > k) {
      const removed = h.poll();
      r.step({
        at: 'if (maxHeap.size() > k) maxHeap.poll();',
        explain: `Over capacity, so evict the farthest point (${removed[0]}, ${removed[1]}) with d² = ${dist(removed)}.`,
        vars: { removed: `(${removed[0]}, ${removed[1]})`, size: h.size },
        visuals: view(i, 'visited', 'error'),
        tone: 'warn',
      });
    }
  }

  const res: number[][] = [];
  while (h.size > 0) res.push(h.poll());
  r.step({
    at: 'for (int i = 0; i < k; i++) res[i] = maxHeap.poll();',
    explain: `Drain the heap: the ${k} closest points, farthest first.`,
    visuals: [chips('res', res.map((p) => `(${p[0]}, ${p[1]})`))],
    tone: 'success',
    result: `return [${res.map((p) => `[${p[0]},${p[1]}]`).join(', ')}]`,
  });
}

/* ── Design Twitter ───────────────────────────────────────────────────────── */

type TwitterOp = ['post', number, number] | ['follow', number, number] | ['unfollow', number, number] | ['feed', number];

function designTwitter(r: Recorder, ops: TwitterOp[]) {
  const tweets = new Map<number, [number, number][]>(); // user -> [tweetId, time]
  const follows = new Map<number, Set<number>>();
  let time = 0;

  const tweetsViz = (activeUser?: number): Visual => ({
    kind: 'text',
    title: 'tweetsMap  (user → tweets, oldest first)',
    emptyHint: '{}',
    chips: false,
    lines: [...tweets].map(([user, list_]) => ({
      text: `${user}: ${list_.map(([id, t]) => `#${id}@t${t}`).join('  ')}`,
      state: user === activeUser ? ('active' as CellState) : undefined,
    })),
  });

  const followsViz = (): Visual =>
    mapOf('followersMap  (user → followees)', [...follows].map(([u, s]) => [u, `{${[...s].join(', ')}}`]));

  r.step({
    at: 'public Twitter() {',
    explain:
      'Tweets are appended per user with a global timestamp, so each user’s list is already sorted by recency. The news feed is then a k-way merge of those lists.',
    visuals: [tweetsViz(), followsViz()],
  });

  for (const op of ops) {
    if (op[0] === 'post') {
      const [, userId, tweetId] = op;
      const listForUser = tweets.get(userId) ?? [];
      listForUser.push([tweetId, time]);
      tweets.set(userId, listForUser);
      r.step({
        at: ['int[] tweet = new int[] { tweetId, time };', 'time++;'],
        explain: `postTweet(${userId}, ${tweetId}) appends the tweet with timestamp ${time}, then the clock ticks.`,
        vars: { userId, tweetId, time },
        visuals: [tweetsViz(userId), followsViz()],
      });
      time++;
      continue;
    }
    if (op[0] === 'follow') {
      const [, a, b] = op;
      const set = follows.get(a) ?? new Set<number>();
      set.add(b);
      follows.set(a, set);
      r.step({
        at: 'followersMap.computeIfAbsent(followerId, k -> new HashSet<>()).add(followeeId);',
        explain: `follow(${a}, ${b}): user ${a} now sees user ${b}'s tweets.`,
        vars: { followerId: a, followeeId: b },
        visuals: [tweetsViz(), followsViz()],
      });
      continue;
    }
    if (op[0] === 'unfollow') {
      const [, a, b] = op;
      follows.get(a)?.delete(b);
      r.step({
        at: 'followees.remove(followeeId);',
        explain: `unfollow(${a}, ${b}).`,
        vars: { followerId: a, followeeId: b },
        visuals: [tweetsViz(), followsViz()],
      });
      continue;
    }

    // getNewsFeed
    const userId = op[1];
    const followers = new Set(follows.get(userId) ?? []);
    followers.add(userId);
    // Heap entries: [tweetId, time, user, nextIndex] ordered by time descending.
    const h = new BinaryHeap<[number, number, number, number]>((a, b) => b[1] - a[1]);
    const heapViz = (state?: CellState): Visual =>
      heap('maxHeap  (the newest unread tweet of each followee)', h.items.map(([id, t, u]) => `#${id}@t${t} (u${u})`), 'max', {
        states: h.items.map((_, i) => (i === 0 ? state : undefined)),
      });

    r.step({
      at: ['Set<Integer> followers = new HashSet<>(', 'followers.add(userId);'],
      explain: `getNewsFeed(${userId}): gather the followees ${[...followers].join(', ')} — including the user, who sees their own tweets.`,
      vars: { userId, followees: `{${[...followers].join(', ')}}` },
      visuals: [tweetsViz(userId), followsViz()],
    });

    for (const follower of followers) {
      const list_ = tweets.get(follower);
      if (!list_) continue;
      const index = list_.length - 1;
      h.offer([list_[index][0], list_[index][1], follower, index - 1]);
      r.step({
        at: ['int index = tweets.size() - 1;', 'maxHeap.offer(new int[] { tweet[0], tweet[1], follower, index - 1 });'],
        explain: `Seed the frontier with user ${follower}'s newest tweet #${list_[index][0]} (t${list_[index][1]}), remembering where to continue in their list.`,
        vars: { follower, tweetId: list_[index][0], index },
        visuals: [tweetsViz(follower), heapViz('window')],
      });
    }

    const feed: number[] = [];
    while (h.size > 0 && feed.length < 10) {
      const top = h.poll();
      feed.push(top[0]);
      r.step({
        at: ['int[] topTweet = maxHeap.poll();', 'topTenTweets.add(topTweet[0]);'],
        explain: `The newest tweet in the frontier is #${top[0]} (t${top[1]}) from user ${top[2]} — it is next in the feed.`,
        vars: { tweetId: top[0], time: top[1], user: top[2], feedSize: feed.length },
        visuals: [heapViz('success'), chips('topTenTweets', feed.map((id) => `#${id}`))],
        tone: 'success',
      });

      const nextIndex = top[3];
      if (nextIndex >= 0) {
        const nt = tweets.get(top[2])![nextIndex];
        h.offer([nt[0], nt[1], top[2], nextIndex - 1]);
        r.step({
          at: ['if (topTweetIndex >= 0) {', 'maxHeap.offer(new int[] { newTweet[0], newTweet[1], topTweet[2], topTweetIndex - 1 });'],
          explain: `User ${top[2]} has an older tweet #${nt[0]} (t${nt[1]}) — push it so it can still compete with the other users' tweets.`,
          vars: { user: top[2], tweetId: nt[0], nextIndex },
          visuals: [heapViz('window'), chips('topTenTweets', feed.map((id) => `#${id}`))],
        });
      }
    }

    r.step({
      at: 'return topTenTweets;',
      explain: `The feed holds the ${feed.length} most recent tweet(s), newest first.`,
      visuals: [chips('topTenTweets', feed.map((id) => `#${id}`))],
      tone: 'success',
      result: `getNewsFeed(${userId}) = [${feed.join(', ')}]`,
    });
  }
}

/* ── Task Scheduler ───────────────────────────────────────────────────────── */

function taskScheduler(r: Recorder, tasksInput: string, n: number) {
  const tasks = chars(tasksInput);
  const count = new Array(26).fill(0);
  for (const t of tasks) count[t.charCodeAt(0) - 65]++;
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  const h = maxHeap();
  for (const c of count) if (c > 0) h.offer(c);

  // Cooldown queue: pairs of [remaining count, time it becomes available again].
  const q: [number, number][] = [];
  let time = 0;

  const heapLabel = (cnt: number) => `${cnt}×`;
  const view = (state: CellState = 'active'): Visual[] => [
    heap('maxHeap  (frequency of each task still available)', h.items.map(heapLabel), 'max', {
      states: h.items.map((_, i) => (i === 0 ? state : undefined)),
    }),
    chips(
      'cooldown queue  (count, available at)',
      q.map(([cnt, at]) => `${cnt}× @t${at}`),
      { emptyHint: '[]' },
    ),
  ];

  r.step({
    at: "for (char task : tasks) count[task - 'A']++;",
    explain: `Count how often each task letter occurs: ${letters
      .map((l, i) => (count[i] ? `${l}×${count[i]}` : null))
      .filter(Boolean)
      .join(', ')}.`,
    vars: { n },
    visuals: [arr(tasks, { title: 'tasks' })],
  });

  r.step({
    at: 'for (int cnt : count) if (cnt > 0) maxHeap.add(cnt);',
    explain:
      'The most frequent remaining task is always the best one to run next — running it now buys the most time for its cooldown to expire elsewhere.',
    visuals: view('window'),
  });

  while (h.size > 0 || q.length > 0) {
    time++;

    if (h.size === 0) {
      const idleUntil = q[0][1];
      r.step({
        at: ['if (maxHeap.isEmpty()) {', 'time = q.peek()[1];'],
        explain: `No task is currently available — every remaining task is cooling down, so jump straight to t${idleUntil}, the next moment anything can run, instead of ticking one idle slot at a time.`,
        vars: { time: idleUntil },
        visuals: view('idle'),
        tone: 'warn',
      });
      time = idleUntil;
    } else {
      const cnt = h.poll() - 1;
      r.step({
        at: ['int cnt = maxHeap.poll() - 1;', 'if (cnt > 0) {'],
        explain: `t${time}: run the most frequent available task (had count ${cnt + 1}, now ${cnt} left).`,
        vars: { time, cnt },
        visuals: view('success'),
        tone: 'success',
      });
      if (cnt > 0) {
        q.push([cnt, time + n]);
        r.step({
          at: 'q.add(new int[] { cnt, time + n });',
          explain: `That task still has ${cnt} occurrence(s) left, so it goes into cooldown until t${time + n} = t${time} + n(${n}).`,
          vars: { cnt, availableAt: time + n },
          visuals: view('window'),
        });
      }
    }

    if (q.length > 0 && q[0][1] === time) {
      const [cnt] = q.shift()!;
      h.offer(cnt);
      r.step({
        at: ['if (!q.isEmpty() && q.peek()[1] == time) {', 'maxHeap.add(q.poll()[0]);'],
        explain: `A task's cooldown just ended at t${time} — it rejoins the heap with ${cnt} occurrence(s) left.`,
        vars: { time, cnt },
        visuals: view('success'),
        tone: 'success',
      });
    }
  }

  r.step({
    at: 'return time;',
    explain: `Every task has run; the schedule needed ${time} time unit(s), including any idle slots.`,
    vars: { time },
    visuals: view('idle'),
    tone: 'success',
    result: `return ${time}`,
  });
}

/* ── Reorganize String ────────────────────────────────────────────────────── */

function reorganizeString(r: Recorder, s: string) {
  const letters = chars(s);
  const frequencies = new Map<string, number>();
  // [frequency, letter]
  const h = new BinaryHeap<[number, string]>((a, b) => b[0] - a[0]);
  let previous: [number, string] | null = null;
  let res = '';

  const fmt = ([f, c]: [number, string]) => `${c}×${f}`;
  const view = (o: { i?: number; rootState?: CellState } = {}): Visual[] => [
    arr(letters, {
      title: 's',
      states: letters.map((_, x) => (o.i === undefined ? undefined : x === o.i ? 'active' : x < o.i ? 'visited' : undefined)),
    }),
    mapOf('frequencies', [...frequencies]),
    heap('maxHeap  (most frequent letter on top)', h.items.map(fmt), 'max', {
      states: h.items.map((_, x) => (x === 0 ? o.rootState : undefined)),
    }),
    chips('previous  (sits out one turn)', previous ? [fmt(previous)] : [], { emptyHint: 'null' }),
    arr(chars(res), { title: 'res' }),
  ];

  r.step({
    at: 'PriorityQueue<int[]> maxHeap = new PriorityQueue<>(',
    explain:
      'Greedy idea: always place the most frequent letter that is allowed next. A max-heap hands it over in O(log k), and holding the just-used letter aside for one turn guarantees no two neighbours match.',
    visuals: view(),
  });

  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    frequencies.set(c, (frequencies.get(c) ?? 0) + 1);
    r.step({
      at: ['frequencies.computeIfAbsent(c, k -> 0);', 'frequencies.put(c, frequencies.get(c) + 1);'],
      explain: `Count '${c}' — it has now appeared ${frequencies.get(c)} time(s).`,
      vars: { c, count: frequencies.get(c) },
      visuals: view({ i }),
    });
  }

  for (const letter of javaHashMapOrder([...frequencies.keys()], (k) => k.charCodeAt(0))) {
    const frequency = frequencies.get(letter)!;
    h.offer([frequency, letter]);
    r.step({
      at: 'maxHeap.add(new int[] { frequency, letter });',
      explain: `Push '${letter}' with frequency ${frequency}; the heap reorders so the most frequent letter is at the root.`,
      vars: { letter, frequency },
      visuals: view({ rootState: 'window' }),
    });
  }

  while (h.size > 0) {
    const current = h.poll();
    res += current[1];
    current[0]--;
    r.step({
      at: ['int[] current = maxHeap.poll();', 'res.append((char) current[1]);', 'current[0]--;'],
      explain: `'${current[1]}' is the most frequent letter still allowed, so place it now — ${current[0]} left. The letter placed last turn is still held aside, so this one is guaranteed to differ from it.`,
      vars: { current: current[1], remaining: current[0], res },
      visuals: view(),
      tone: 'success',
    });

    if (previous !== null && previous[0] > 0) {
      h.offer(previous);
      r.step({
        at: ['if (previous != null && previous[0] > 0)', 'maxHeap.add(previous);'],
        explain: `'${previous[1]}' has sat out a turn and still has ${previous[0]} left, so it is allowed back into the heap.`,
        vars: { previous: previous[1], remaining: previous[0] },
        visuals: view({ rootState: 'window' }),
      });
    } else if (previous !== null) {
      r.step({
        at: 'if (previous != null && previous[0] > 0)',
        explain: `'${previous[1]}' is used up, so it does not go back into the heap.`,
        vars: { previous: previous[1] },
        visuals: view(),
      });
    }

    previous = current;
    r.step({
      at: 'previous = current;',
      explain: `'${current[1]}' is held aside for one turn so the next letter is guaranteed to differ.`,
      vars: { previous: current[1] },
      visuals: view({ rootState: 'active' }),
    });
  }

  const ok = res.length === s.length;
  r.step({
    at: 'return res.length() == s.length() ? res.toString() : "";',
    explain: ok
      ? 'Every letter was placed without two equal neighbours.'
      : `The heap ran dry while '${previous![1]}' still had ${previous![0]} left waiting — it has no other letter to separate it, so no valid arrangement exists.`,
    vars: { 'res.length()': res.length, 's.length()': s.length },
    visuals: view(),
    tone: ok ? 'success' : 'error',
    result: `return "${ok ? res : ''}"`,
  });
}

/* ── Single-Threaded CPU ──────────────────────────────────────────────────── */

function singleThreadedCPU(r: Recorder, tasks: number[][]) {
  type Task = [number, number, number]; // [index, enqueueTime, processingTime]
  const queue = new BinaryHeap<Task>((a, b) => a[1] - b[1]);
  const minHeap_ = new BinaryHeap<Task>((a, b) => a[2] - b[2] || a[0] - b[0]);
  const res: number[] = [];
  let time = 1;

  const fmt = ([i, e, p]: Task) => `T${i} e${e} p${p}`;
  const view = (o: { queueState?: CellState; heapState?: CellState; running?: number } = {}): Visual[] => [
    arr(tasks.map((_, i) => `T${i}`), {
      title: 'tasks',
      labels: tasks.map(([e, p]) => `e${e} p${p}`),
      indexed: false,
      states: tasks.map((_, i) => (i === o.running ? 'active' : res.includes(i) ? 'done' : undefined)),
    }),
    heap('queue  (not enqueued yet — earliest enqueueTime on top)', queue.items.map(fmt), 'min', {
      states: queue.items.map((_, x) => (x === 0 ? o.queueState : undefined)),
    }),
    heap('minHeap  (available now — shortest, then lowest index, on top)', minHeap_.items.map(fmt), 'min', {
      states: minHeap_.items.map((_, x) => (x === 0 ? o.heapState : undefined)),
    }),
    chips('res', res.map((i) => `T${i}`), { emptyHint: '[]' }),
  ];

  r.step({
    at: 'PriorityQueue<int[]> queue = new PriorityQueue<>(',
    explain:
      'Two heaps split the tasks by whether they exist yet: one ordered by arrival time, one ordered by what the CPU actually prefers among the arrived tasks (shortest first, then lowest index).',
    visuals: view(),
  });

  for (let i = 0; i < tasks.length; i++) queue.offer([i, tasks[i][0], tasks[i][1]]);
  r.step({
    at: 'queue.offer(new int[]{ i, task[0], task[1] });',
    explain: 'Every task enters the arrival queue tagged with its original index — the index is both the answer and the tie-breaker.',
    visuals: view({ queueState: 'window' }),
  });

  while (queue.size > 0 || minHeap_.size > 0) {
    if (minHeap_.size === 0) {
      const next = queue.peek()[1];
      const jumped = next > time;
      time = Math.max(time, next);
      r.step({
        at: ['if (minHeap.isEmpty()) {', 'time = Math.max(time, queue.peek()[1]);'],
        explain: jumped
          ? `The CPU is idle and nothing has arrived yet — skip straight to t${time}, when the next task shows up.`
          : `Nothing is waiting, but the next task arrived at t${next}, before the CPU freed up — time stays at t${time}.`,
        vars: { time },
        visuals: view({ queueState: 'active' }),
        tone: jumped ? 'warn' : undefined,
      });
    }

    const moved: number[] = [];
    while (queue.size > 0 && queue.peek()[1] <= time) {
      const t = queue.poll();
      minHeap_.offer(t);
      moved.push(t[0]);
    }
    if (moved.length > 0) {
      r.step({
        at: ['while (!queue.isEmpty() && queue.peek()[1] <= time) {', 'minHeap.offer(queue.poll());'],
        explain: `By t${time}, ${moved.map((i) => `T${i}`).join(', ')} ${moved.length === 1 ? 'has' : 'have'} arrived, so ${moved.length === 1 ? 'it moves' : 'they move'} into the available heap.`,
        vars: { time, moved: moved.length },
        visuals: view({ heapState: 'window' }),
      });
    }

    const task = minHeap_.poll();
    res.push(task[0]);
    r.step({
      at: ['int[] task = minHeap.poll();', 'res[index] = task[0];', 'time += task[2];'],
      explain: `Of the available tasks, T${task[0]} has the shortest processing time${minHeap_.size > 0 ? ' (ties go to the lower index)' : ''}. It runs from t${time} to t${time + task[2]}, and nothing can interrupt it.`,
      vars: { index: res.length - 1, task: task[0], time: time + task[2] },
      visuals: view({ running: task[0] }),
      tone: 'success',
    });
    time += task[2];
  }

  r.step({
    at: 'return res;',
    explain: 'Every task has run; res is the order the CPU picked them in.',
    visuals: view(),
    tone: 'success',
    result: `return ${list(res)}`,
  });
}

/* ── Longest Happy String ─────────────────────────────────────────────────── */

function longestHappyString(r: Recorder, a: number, b: number, c: number) {
  // [letter, frequency]
  const h = new BinaryHeap<[string, number]>((x, y) => y[1] - x[1]);
  let res = '';

  const fmt = ([l, f]: [string, number]) => `${l}×${f}`;
  const view = (o: { rootState?: CellState; held?: [string, number]; last?: CellState } = {}): Visual[] => [
    heap('maxHeap  (letters left, most plentiful on top)', h.items.map(fmt), 'max', {
      states: h.items.map((_, x) => (x === 0 ? o.rootState : undefined)),
    }),
    chips('polled', o.held ? [fmt(o.held)] : [], { emptyHint: '—' }),
    arr(chars(res), {
      title: 'res',
      states: chars(res).map((_, x) => (x === res.length - 1 ? o.last : undefined)),
    }),
  ];

  r.step({
    at: 'PriorityQueue<int[]> maxHeap = new PriorityQueue<>(',
    explain:
      'Spend the most plentiful letter whenever possible — the scarce letters are what break up runs, so they should be saved for when they are needed.',
    vars: { a, b, c },
    visuals: view(),
  });

  if (a > 0) h.offer(['a', a]);
  if (b > 0) h.offer(['b', b]);
  if (c > 0) h.offer(['c', c]);
  r.step({
    at: ["if (a > 0) maxHeap.offer(new int[] { 'a', a });", "if (b > 0) maxHeap.offer(new int[] { 'b', b });", "if (c > 0) maxHeap.offer(new int[] { 'c', c });"],
    explain: 'Only letters with a non-zero budget enter the heap.',
    visuals: view({ rootState: 'window' }),
  });

  const canAppend = (cur: string) => res.length < 2 || cur !== res[res.length - 1] || cur !== res[res.length - 2];

  while (h.size > 0) {
    const first = h.poll();

    if (canAppend(first[0])) {
      res += first[0];
      first[1]--;
      if (first[1] > 0) h.offer(first);
      r.step({
        at: ['int[] first = maxHeap.poll();', 'if (canAppend(res, first)) {', 'res.append((char) first[0]);', 'if (first[1] > 0) maxHeap.offer(first);'],
        explain:
          first[1] > 0
            ? `'${first[0]}' is the most plentiful and would not make three in a row, so append it and put it back with ${first[1]} left.`
            : `'${first[0]}' is the most plentiful and would not make three in a row; that was its last copy, so it leaves the heap.`,
        vars: { letter: first[0], left: first[1], res },
        visuals: view({ last: 'success' }),
        tone: 'success',
      });
      continue;
    }

    r.step({
      at: ['int[] first = maxHeap.poll();', 'if (canAppend(res, first)) {', 'current[0] != res.charAt(res.length() - 2);'],
      explain: `res already ends in '${first[0]}${first[0]}', so a third '${first[0]}' would break the rule even though it is the most plentiful.`,
      vars: { letter: first[0], left: first[1], res },
      visuals: view({ held: first }),
      tone: 'warn',
    });

    if (h.size === 0) {
      r.step({
        at: 'if (maxHeap.isEmpty()) break;',
        explain: `Only '${first[0]}' is left and nothing can separate it from the run — the string cannot grow any further.`,
        vars: { leftover: `${first[0]}×${first[1]}` },
        visuals: view({ held: first }),
        tone: 'error',
      });
      break;
    }

    const second = h.poll();
    h.offer(first);
    res += second[0];
    second[1]--;
    if (second[1] > 0) h.offer(second);
    r.step({
      at: ['int[] second = maxHeap.poll();', 'maxHeap.offer(first);@2', 'res.append((char) second[0]);', 'if (second[1] > 0) maxHeap.offer(second);'],
      explain: `Spend the runner-up '${second[0]}' instead to break the run (${second[1]} left), and return '${first[0]}' to the heap untouched — it will be allowed again next turn.`,
      vars: { letter: second[0], left: second[1], res },
      visuals: view({ last: 'success' }),
      tone: 'success',
    });
  }

  r.step({
    at: 'return res.toString();',
    explain: `The longest string with no three equal letters in a row has length ${res.length}.`,
    vars: { length: res.length },
    visuals: view(),
    tone: 'success',
    result: `return "${res}"`,
  });
}

/* ── Car Pooling ──────────────────────────────────────────────────────────── */

function carPooling(r: Recorder, trips: number[][], capacity: number) {
  type Trip = [number, number, number, number]; // [numPassengers, from, to, original index]
  const queue = new BinaryHeap<Trip>((a, b) => a[1] - b[1]);
  const currentRide = new BinaryHeap<Trip>((a, b) => a[2] - b[2]);
  const status: (CellState | undefined)[] = trips.map(() => undefined);
  let currentLoad = 0;
  let currentPosition = 0;

  const fmt = ([p, f, t]: Trip) => `${p}p ${f}→${t}`;
  const maxTo = Math.max(...trips.map((t) => t[2]));
  const view = (o: { queueState?: CellState; rideState?: CellState } = {}): Visual[] => [
    intervalsViz(
      'trips  (blue = in the car, done = dropped off)',
      trips.map(([p, f, t], i) => ({ start: f, end: t, label: `${p}p`, state: status[i] })),
      { min: 0, max: maxTo },
    ),
    heap('queue  (waiting — nearest pickup on top)', queue.items.map(fmt), 'min', {
      states: queue.items.map((_, x) => (x === 0 ? o.queueState : undefined)),
    }),
    heap('currentRide  (in the car — earliest drop-off on top)', currentRide.items.map(fmt), 'min', {
      states: currentRide.items.map((_, x) => (x === 0 ? o.rideState : undefined)),
    }),
  ];
  const vars = () => ({ currentPosition, currentLoad, capacity });

  r.step({
    at: 'PriorityQueue<int[]> queue = new PriorityQueue<>(',
    explain:
      'Only pickups and drop-offs change the load, so instead of driving kilometre by kilometre the car jumps from one pickup point to the next.',
    vars: vars(),
    visuals: view(),
  });

  trips.forEach(([p, f, t], i) => queue.offer([p, f, t, i]));
  r.step({
    at: 'Arrays.stream(trips).forEach(queue::offer);',
    explain: 'Every trip waits in a min-heap keyed by its pickup point.',
    vars: vars(),
    visuals: view({ queueState: 'window' }),
  });

  while (queue.size > 0) {
    currentPosition = queue.peek()[1];
    r.step({
      at: 'currentPosition = queue.peek()[1];',
      explain: `The nearest pickup is at ${currentPosition} — jump there directly.`,
      vars: vars(),
      visuals: view({ queueState: 'active' }),
    });

    while (currentRide.size > 0 && currentPosition >= currentRide.peek()[2]) {
      const trip = currentRide.poll();
      currentLoad -= trip[0];
      status[trip[3]] = 'done';
      r.step({
        at: ['while (!currentRide.isEmpty() && currentPosition >= currentRide.peek()[2]) {', 'currentLoad -= currentRide.poll()[0];'],
        explain: `The ${trip[0]} passenger(s) going to ${trip[2]} have arrived by ${currentPosition}, so they get out before anyone new gets in — that frees ${trip[0]} seat(s).`,
        vars: vars(),
        visuals: view({ rideState: 'done' }),
      });
    }

    while (queue.size > 0 && currentPosition === queue.peek()[1]) {
      const next = queue.peek();
      if (next[0] + currentLoad > capacity) {
        status[next[3]] = 'error';
        r.step({
          at: ['while (!queue.isEmpty() && currentPosition == queue.peek()[1]) {', 'if (queue.peek()[0] + currentLoad > capacity) return false;'],
          explain: `${next[0]} more passenger(s) would make ${next[0] + currentLoad}, over the capacity of ${capacity} — and nobody else gets out here, so the trip is impossible.`,
          vars: { ...vars(), wouldBe: next[0] + currentLoad },
          visuals: view({ queueState: 'error' }),
          tone: 'error',
          result: 'return false',
        });
        return;
      }
      currentLoad += next[0];
      currentRide.offer(queue.poll());
      status[next[3]] = 'active';
      r.step({
        at: ['currentLoad += queue.peek()[0];', 'currentRide.offer(queue.poll());'],
        explain: `Pick up ${next[0]} passenger(s) heading to ${next[2]} — the load becomes ${currentLoad} of ${capacity}.`,
        vars: vars(),
        visuals: view({ rideState: 'window' }),
        tone: 'success',
      });
    }
  }

  r.step({
    at: 'return true;',
    explain: 'Every pickup fit. Those still in the car only ever get out, so the load can no longer exceed capacity.',
    vars: vars(),
    visuals: view(),
    tone: 'success',
    result: 'return true',
  });
}

/* ── Top K Frequent Words ─────────────────────────────────────────────────── */

function topKFrequentWords(r: Recorder, words: string[], k: number) {
  const frequenciesMap = new Map<string, number>();
  const h = new BinaryHeap<string>(
    (a, b) => frequenciesMap.get(a)! - frequenciesMap.get(b)! || compareStrings(b, a),
  );
  let res: string[] = [];

  const fmt = (w: string) => `${w}×${frequenciesMap.get(w)}`;
  const view = (o: { i?: number; rootState?: CellState; key?: string } = {}): Visual[] => [
    arr(words, {
      title: 'words',
      states: words.map((_, x) => (o.i === undefined ? undefined : x === o.i ? 'active' : x < o.i ? 'visited' : undefined)),
    }),
    mapOf('frequenciesMap', [], {
      entries: [...frequenciesMap].map(([key, value]) => ({ key, value, state: key === o.key ? ('active' as CellState) : undefined })),
    }),
    heap(`minHeap  (the best ${k} so far, weakest on top)`, h.items.map(fmt), 'min', {
      states: h.items.map((_, x) => (x === 0 ? o.rootState : undefined)),
    }),
  ];

  r.step({
    at: 'Map<String, Integer> frequenciesMap = new HashMap<>();',
    explain: 'First count every word, then keep only the k strongest with a size-k heap.',
    vars: { k },
    visuals: view(),
  });

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    frequenciesMap.set(word, (frequenciesMap.get(word) ?? 0) + 1);
    r.step({
      at: ['frequenciesMap.computeIfAbsent(word, key -> 0);', 'frequenciesMap.put(word, frequenciesMap.get(word) + 1);'],
      explain: `"${word}" has now been seen ${frequenciesMap.get(word)} time(s).`,
      vars: { word, count: frequenciesMap.get(word) },
      visuals: view({ i, key: word }),
    });
  }

  r.step({
    at: 'PriorityQueue<String> minHeap = new PriorityQueue<>(',
    explain:
      'The root must be the weakest candidate: lowest frequency, and among equal frequencies the lexicographically LARGEST word (it would rank last in the answer). Hence the reversed tie-breaker.',
    vars: { k },
    visuals: view(),
  });

  for (const word of javaHashMapOrder([...frequenciesMap.keys()], javaStringHash)) {
    h.offer(word);
    r.step({
      at: 'minHeap.offer(e.getKey());',
      explain: `Offer "${word}" (frequency ${frequenciesMap.get(word)}).`,
      vars: { word, frequency: frequenciesMap.get(word), size: h.size },
      visuals: view({ key: word, rootState: 'window' }),
    });
    if (h.size > k) {
      const removed = h.poll();
      r.step({
        at: 'if (minHeap.size() > k) minHeap.poll();@2',
        explain: `${k + 1} candidates is one too many — evict the weakest, "${removed}" (frequency ${frequenciesMap.get(removed)}). Each heap operation stays O(log k).`,
        vars: { removed, size: h.size },
        visuals: view({ rootState: 'error' }),
        tone: 'warn',
      });
    }
  }

  while (h.size > 0) res.push(h.poll());
  r.step({
    at: 'while (!minHeap.isEmpty()) res.add(minHeap.poll());',
    explain: 'Draining a min-heap yields the weakest first — the exact reverse of the order the answer wants.',
    visuals: [chips('res', res)],
  });

  res = res.slice().reverse();
  r.step({
    at: 'Collections.reverse(res);',
    explain: 'Reverse once: most frequent first, ties in alphabetical order.',
    visuals: [chips('res', res)],
    tone: 'success',
    result: `return [${res.map((w) => `"${w}"`).join(', ')}]`,
  });
}

/* ── Search Suggestions System ────────────────────────────────────────────── */

function searchSuggestions(r: Recorder, products: string[], searchWord: string) {
  const res: string[][] = [];

  const resViz = (activeRow?: number): Visual => ({
    kind: 'text',
    title: 'res',
    emptyHint: '[]',
    lines: res.map((row, i) => ({
      text: `${searchWord.slice(0, i + 1)}: [${row.join(', ')}]`,
      state: i === activeRow ? ('active' as CellState) : undefined,
    })),
  });

  r.step({
    at: 'List<List<String>> res = new ArrayList<>();',
    explain:
      'For every prefix of the search word, keep at most 3 matching products. A max-heap of size 3 throws out the lexicographically largest match as soon as a fourth one arrives, so nothing ever needs a full sort.',
    vars: { searchWord },
    visuals: [arr(products, { title: 'products' }), resViz()],
  });

  for (let i = 0; i < searchWord.length; i++) {
    const prefix = searchWord.slice(0, i + 1);
    res.push([]);
    const h = new BinaryHeap<string>((a, b) => compareStrings(b, a));
    const matched = new Set<number>();

    const view = (j: number, state: CellState | undefined, rootState?: CellState): Visual[] => [
      arr(products, {
        title: `products  (prefix "${prefix}")`,
        states: products.map((_, x) =>
          x === j ? state : x < j ? (matched.has(x) ? ('success' as CellState) : ('muted' as CellState)) : undefined,
        ),
        pointers: j >= 0 && j < products.length ? [{ name: 'product', index: j }] : [],
      }),
      heap('maxHeap  (≤ 3 matches, largest on top)', h.items, 'max', {
        states: h.items.map((_, x) => (x === 0 ? rootState : undefined)),
      }),
      resViz(i),
    ];

    r.step({
      at: ['String prefix = searchWord.substring(0, i + 1);', 'res.add(new ArrayList<>());'],
      explain: `Prefix "${prefix}": start a fresh max-heap and scan every product.`,
      vars: { i, prefix },
      visuals: view(-1, undefined),
    });

    for (let j = 0; j < products.length; j++) {
      const product = products[j];
      const matches = product.startsWith(prefix);
      if (matches) {
        matched.add(j);
        h.offer(product);
      }
      r.step({
        at: 'if (product.startsWith(prefix)) maxHeap.offer(product);',
        explain: matches ? `"${product}" starts with "${prefix}" — offer it.` : `"${product}" does not start with "${prefix}" — skip it.`,
        vars: { prefix, product, size: h.size },
        visuals: view(j, matches ? 'active' : 'error', matches ? 'window' : undefined),
      });
      if (h.size > 3) {
        const removed = h.poll();
        r.step({
          at: 'if (maxHeap.size() > 3) maxHeap.poll();',
          explain: `Four candidates — evict the lexicographically largest, "${removed}"; it can never be among the 3 smallest.`,
          vars: { removed, size: h.size },
          visuals: view(j, 'active', 'error'),
          tone: 'warn',
        });
      }
    }

    while (h.size > 0) res[i].push(h.poll());
    r.step({
      at: 'while (!maxHeap.isEmpty()) res.get(i).add(maxHeap.poll());',
      explain: 'Draining the max-heap yields the matches largest first.',
      vars: { prefix },
      visuals: view(products.length, undefined),
    });

    res[i].reverse();
    r.step({
      at: 'Collections.reverse(res.get(i));',
      explain: res[i].length > 0 ? `Reverse to get the suggestions for "${prefix}" in alphabetical order.` : `No product starts with "${prefix}", so its suggestion list is empty.`,
      vars: { prefix },
      visuals: view(products.length, undefined),
      tone: 'success',
    });
  }

  r.step({
    at: 'return res;',
    explain: 'One suggestion list per typed character.',
    visuals: [resViz()],
    tone: 'success',
    result: `return [${res.map((row) => `[${row.map((p) => `"${p}"`).join(',')}]`).join(', ')}]`,
  });
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

export const heapTracers: Record<string, Tracer> = {
  'medium/heaps/KthLargestElementInAnArray': {
    examples: [
      { label: 'nums = [2,3,1,5,4], k = 2', input: 'nums = [2, 3, 1, 5, 4], k = 2', run: (r) => findKthLargest(r, [2, 3, 1, 5, 4], 2) },
      { label: 'nums = [3,2,3,1,2,4,5,5,6], k = 4', input: 'nums = [3, 2, 3, 1, 2, 4, 5, 5, 6], k = 4', run: (r) => findKthLargest(r, [3, 2, 3, 1, 2, 4, 5, 5, 6], 4) },
    ],
  },
  'easy/heaps/KthLargestElementInAStream': {
    examples: [
      {
        label: 'k = 3, nums = [4,5,8,2]',
        input: 'k = 3, nums = [4, 5, 8, 2], then add(3), add(5), add(10)',
        run: (r) => kthLargestStream(r, 3, [4, 5, 8, 2], [3, 5, 10]),
      },
    ],
  },
  'easy/heaps/LastStoneWeight': {
    examples: [
      { label: 'stones = [2,7,4,1,8,1]', input: 'stones = [2, 7, 4, 1, 8, 1]', run: (r) => lastStoneWeight(r, [2, 7, 4, 1, 8, 1]) },
      { label: 'stones = [3,3]', input: 'stones = [3, 3]', run: (r) => lastStoneWeight(r, [3, 3]) },
    ],
  },
  'medium/heaps/KClosestPointsToOrigin': {
    examples: [
      { label: 'k = 2', input: 'points = [[0,2],[-2,2],[3,3],[1,1]], k = 2', run: (r) => kClosest(r, [[0, 2], [-2, 2], [3, 3], [1, 1]], 2) },
      { label: 'k = 1', input: 'points = [[1,3],[-2,2]], k = 1', run: (r) => kClosest(r, [[1, 3], [-2, 2]], 1) },
    ],
  },
  'medium/heaps/TaskScheduler': {
    examples: [
      { label: 'tasks = AAABBB, n = 2', input: 'tasks = ["A","A","A","B","B","B"], n = 2', run: (r) => taskScheduler(r, 'AAABBB', 2) },
      { label: 'tasks = AAAAA, n = 2', input: 'tasks = ["A","A","A","A","A"], n = 2', run: (r) => taskScheduler(r, 'AAAAA', 2) },
    ],
  },
  'medium/heaps/DesignTwitter': {
    examples: [
      {
        label: 'post, follow, feed',
        input: 'postTweet(1,5), getNewsFeed(1), follow(1,2), postTweet(2,6), getNewsFeed(1), unfollow(1,2), getNewsFeed(1)',
        run: (r) =>
          designTwitter(r, [
            ['post', 1, 5],
            ['feed', 1],
            ['follow', 1, 2],
            ['post', 2, 6],
            ['feed', 1],
            ['unfollow', 1, 2],
            ['feed', 1],
          ]),
      },
      {
        label: 'several tweets per user',
        input: 'postTweet(1,1), postTweet(1,2), postTweet(2,7), follow(1,2), getNewsFeed(1)',
        run: (r) =>
          designTwitter(r, [
            ['post', 1, 1],
            ['post', 1, 2],
            ['post', 2, 7],
            ['follow', 1, 2],
            ['feed', 1],
          ]),
      },
    ],
  },
  'medium/heaps/ReorganizeString': {
    examples: [
      { label: 's = "aab"', input: 's = "aab"', run: (r) => reorganizeString(r, 'aab') },
      { label: 's = "aaabbc"', input: 's = "aaabbc"', run: (r) => reorganizeString(r, 'aaabbc') },
      { label: 's = "aaab" (impossible)', input: 's = "aaab"', run: (r) => reorganizeString(r, 'aaab') },
    ],
  },
  'medium/heaps/SingleThreadedCPU': {
    examples: [
      { label: 'tasks = [[1,2],[2,4],[3,2],[4,1]]', input: 'tasks = [[1,2],[2,4],[3,2],[4,1]]', run: (r) => singleThreadedCPU(r, [[1, 2], [2, 4], [3, 2], [4, 1]]) },
      {
        label: 'all arrive at once',
        input: 'tasks = [[7,10],[7,12],[7,5],[7,4],[7,2]]',
        run: (r) => singleThreadedCPU(r, [[7, 10], [7, 12], [7, 5], [7, 4], [7, 2]]),
      },
      { label: 'idle gap', input: 'tasks = [[1,1],[5,3],[5,2]]', run: (r) => singleThreadedCPU(r, [[1, 1], [5, 3], [5, 2]]) },
    ],
  },
  'medium/heaps/LongestHappyString': {
    examples: [
      { label: 'a = 1, b = 1, c = 7', input: 'a = 1, b = 1, c = 7', run: (r) => longestHappyString(r, 1, 1, 7) },
      { label: 'a = 7, b = 1, c = 0', input: 'a = 7, b = 1, c = 0', run: (r) => longestHappyString(r, 7, 1, 0) },
      { label: 'a = 2, b = 2, c = 1', input: 'a = 2, b = 2, c = 1', run: (r) => longestHappyString(r, 2, 2, 1) },
    ],
  },
  'medium/heaps/CarPooling': {
    examples: [
      { label: 'capacity = 4 (too small)', input: 'trips = [[2,1,5],[3,3,7]], capacity = 4', run: (r) => carPooling(r, [[2, 1, 5], [3, 3, 7]], 4) },
      {
        label: 'drop-off frees seats',
        input: 'trips = [[2,1,5],[3,5,7],[1,2,6],[2,7,9]], capacity = 4',
        run: (r) => carPooling(r, [[2, 1, 5], [3, 5, 7], [1, 2, 6], [2, 7, 9]], 4),
      },
    ],
  },
  'medium/heaps/TopKFrequentWords': {
    examples: [
      {
        label: 'k = 2',
        input: 'words = ["i","love","leetcode","i","love","coding"], k = 2',
        run: (r) => topKFrequentWords(r, ['i', 'love', 'leetcode', 'i', 'love', 'coding'], 2),
      },
      {
        label: 'k = 3, ties broken alphabetically',
        input: 'words = ["the","day","is","sunny","the","the","sunny","is"], k = 3',
        run: (r) => topKFrequentWords(r, ['the', 'day', 'is', 'sunny', 'the', 'the', 'sunny', 'is'], 3),
      },
    ],
  },
  'medium/heaps/SearchSuggestionSystem': {
    examples: [
      {
        label: 'searchWord = "mouse"',
        input: 'products = ["mobile","mouse","moneypot","monitor","mousepad"], searchWord = "mouse"',
        run: (r) => searchSuggestions(r, ['mobile', 'mouse', 'moneypot', 'monitor', 'mousepad'], 'mouse'),
      },
      {
        label: 'no match after a prefix',
        input: 'products = ["bags","baggage","banner","box"], searchWord = "bat"',
        run: (r) => searchSuggestions(r, ['bags', 'baggage', 'banner', 'box'], 'bat'),
      },
    ],
  },
};
