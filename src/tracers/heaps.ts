import type { Recorder } from '../trace/recorder';
import type { CellState, Tracer, Visual } from '../types';
import { arr, chips, heap, list, mapOf } from './helpers';

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
    at: ['int[] point = maxHeap.poll();', 'res[i++] = point;'],
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
      heap('minHeap  (the newest unread tweet of each followee)', h.items.map(([id, t, u]) => `#${id}@t${t} (u${u})`), 'max', {
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
        at: ['int index = tweets.size() - 1;', 'minHeap.offer(new int[] { tweet[0], tweet[1], follower, index - 1 });'],
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
        at: ['int[] topTweet = minHeap.poll();', 'topTenTweets.add(topTweet[0]);'],
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
          at: ['if (topTweetIndex >= 0) {', 'minHeap.offer(new int[] { newTweet[0], newTweet[1], topTweet[2], topTweetIndex - 1 });'],
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
};
