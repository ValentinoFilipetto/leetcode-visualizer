/**
 * Boots the app in a real browser (via Puppeteer) and steps through every example
 * of one or more solutions, flagging console errors, uncaught exceptions, and
 * tracers that silently died mid-replay (buildSteps() turns a thrown error into
 * an error-toned step instead of crashing the page, so a failure never shows up
 * as a crash — this script has to read the step text to catch it).
 *
 * `pnpm run check` (scripts/check-tracers.ts) validates the trace data itself
 * (snippet resolution, step count) without ever rendering a component. This
 * script is the complement: it validates that the visuals produced from that
 * data actually render, in the actual app, in a real browser.
 *
 * Usage:
 *   node scripts/verify-visualization.mjs <solutionId> [<solutionId> ...]
 *   node scripts/verify-visualization.mjs --all
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/verify-visualization.mjs <solutionId> [...] | --all');
  process.exit(1);
}

const PORT = 5183;
const HOST = '127.0.0.1';

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Dev server did not come up at ${url}`));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function main() {
  const dataModule = await import('../src/data/solutions.generated.json', { with: { type: 'json' } });
  const allIds = dataModule.default.solutions.map((s) => s.id);
  const ids = args[0] === '--all' ? allIds : args;

  for (const id of ids) {
    if (!allIds.includes(id)) {
      console.error(`Unknown solution id: ${id}`);
      process.exit(1);
    }
  }

  console.log(`Starting dev server on port ${PORT}...`);
  const viteBin = join(repoRoot, 'node_modules', '.bin', `vite${process.platform === 'win32' ? '.cmd' : ''}`);
  const server = spawn(viteBin, ['--port', String(PORT), '--strictPort', '--host', HOST], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  let serverOutput = '';
  server.stdout.on('data', (d) => (serverOutput += d));
  server.stderr.on('data', (d) => (serverOutput += d));

  let browser;
  const failures = [];
  try {
    await waitForServer(`http://${HOST}:${PORT}/`);

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (err) => failures.push(`[uncaught exception] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') failures.push(`[console.error] ${msg.text()}`);
    });

    for (const id of ids) {
      console.log(`\n== ${id} ==`);
      failures.length = 0;

      await page.goto(`http://${HOST}:${PORT}/#/${encodeURIComponent(id)}`, { waitUntil: 'networkidle0' });

      const missingTracer = await page.$('.missing-tracer');
      if (missingTracer) {
        failures.push('No tracer registered for this solution (renders "No trace for this solution yet.")');
      } else {
        const exampleCount = await page.evaluate(() => {
          const select = document.querySelector('.example-select');
          return select ? select.options.length : 1;
        });

        for (let ex = 0; ex < exampleCount; ex++) {
          if (exampleCount > 1) {
            await page.select('.example-select', String(ex));
            await page.click('h1'); // move focus off the <select> so arrow keys drive the player, not the dropdown
          }

          const total = await page.evaluate(() => {
            const input = document.querySelector('input[aria-label="Algorithm step"]');
            return input ? Number(input.max) + 1 : 0;
          });
          if (total === 0) {
            failures.push(`example ${ex}: player reports 0 steps`);
            continue;
          }

          await page.evaluate(() => document.querySelector('.step-btn[title^="First step"]')?.click());
          for (let i = 0; i < total; i++) {
            const explain = await page.evaluate(() => document.querySelector('.explain-text')?.textContent ?? '');
            if (explain.startsWith('This trace stopped early:')) {
              failures.push(`example ${ex}, step ${i + 1}/${total}: tracer threw — "${explain}"`);
              break;
            }
            if (i < total - 1) await page.keyboard.press('ArrowRight');
          }
        }
      }

      if (failures.length > 0) {
        console.log(`FAIL (${failures.length} issue(s)):`);
        for (const f of failures) console.log(`  - ${f}`);
        process.exitCode = 1;
      } else {
        console.log('PASS — every example replayed with no console errors, exceptions, or stalled tracers.');
      }
    }
  } finally {
    if (browser) await browser.close();
    if (process.platform === 'win32' && server.pid) {
      // shell:true on Windows wraps vite in a cmd.exe process; killing just that
      // wrapper leaves node.exe (and the port) behind, so kill the whole tree.
      spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
    if (process.exitCode) console.log('\nDev server output (for debugging):\n' + serverOutput.slice(-4000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
