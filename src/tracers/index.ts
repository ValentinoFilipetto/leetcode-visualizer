import type { Tracer } from '../types';
import { miscTracers } from './misc';
import { trieTracers } from './tries';
import { intervalTracers } from './intervals';
import { heapTracers } from './heaps';
import { backtrackingTracers } from './backtracking';
import { graphTracers } from './graphs';
import { treeTracers } from './trees';
import { linkedListTracers } from './linkedlist';
import { binarySearchTracers } from './binarysearch';
import { hashingTracers } from './hashing';
import { slidingWindowTracers } from './slidingwindow';
import { stackTracers } from './stack';
import { twoPointerTracers } from './twopointers';

/**
 * Every tracer, keyed by solution id (`difficulty/category/ClassName`).
 * `npm run check` replays all of them and reports any solution without one.
 */
export const tracers: Record<string, Tracer> = {
  ...hashingTracers,
  ...twoPointerTracers,
  ...slidingWindowTracers,
  ...binarySearchTracers,
  ...stackTracers,
  ...linkedListTracers,
  ...treeTracers,
  ...graphTracers,
  ...backtrackingTracers,
  ...heapTracers,
  ...intervalTracers,
  ...trieTracers,
  ...miscTracers,
};
