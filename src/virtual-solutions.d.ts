/** Modules generated from solutions.generated.json by the `solution-data` plugin in vite.config.ts. */
declare module 'virtual:solutions' {
  import type { SolutionMeta } from './types';

  export const solutions: SolutionMeta[];
  /** One lazy chunk per solution id, holding its Java source. */
  export const codeLoaders: Record<string, () => Promise<{ default: string }>>;
}
