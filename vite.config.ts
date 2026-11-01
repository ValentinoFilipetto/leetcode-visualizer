import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const DATA_FILE = resolve(__dirname, 'src/data/solutions.generated.json');
const INDEX_ID = 'virtual:solutions';
const CODE_PREFIX = 'virtual:solution-code/';

/**
 * Serves solutions.generated.json as two kinds of module, so the Java source (most of the file)
 * stays out of the main bundle:
 * - `virtual:solutions`: every solution's metadata, plus a lazy loader per solution id
 * - `virtual:solution-code/<id>`: one solution's source, its own small chunk
 */
function solutionData(): Plugin {
  return {
    name: 'solution-data',
    resolveId(id) {
      if (id === INDEX_ID || id.startsWith(CODE_PREFIX)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith('\0virtual:')) return;
      this.addWatchFile(DATA_FILE);
      const { solutions } = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as { solutions: { id: string; code: string }[] };

      if (id === `\0${INDEX_ID}`) {
        const meta = solutions.map(({ code: _code, ...rest }) => rest);
        const loaders = solutions.map((s) => `  ${JSON.stringify(s.id)}: () => import(${JSON.stringify(CODE_PREFIX + s.id)}),`);
        return `export const solutions = ${JSON.stringify(meta)};\nexport const codeLoaders = {\n${loaders.join('\n')}\n};\n`;
      }

      const solutionId = id.slice(`\0${CODE_PREFIX}`.length);
      const solution = solutions.find((s) => s.id === solutionId);
      if (!solution) this.error(`No solution "${solutionId}" in ${DATA_FILE}`);
      return `export default ${JSON.stringify(solution.code)};\n`;
    },
  };
}

// GitHub Pages friendly: set BASE_PATH=/repo-name/ when deploying to a project page.
export default defineConfig({
  plugins: [react(), solutionData()],
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', sourcemap: false },
});
