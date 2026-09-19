import { useEffect, useMemo, useRef, useState } from 'react';
import { Recorder } from '../trace/recorder';
import type { Solution, Step, Tracer } from '../types';
import { CodePanel } from './CodePanel';
import { Player } from './Player';
import { VisualView } from './viz/VisualView';

function buildSteps(code: string, tracer: Tracer | undefined, exampleIndex: number): { steps: Step[]; input: string } {
  if (!tracer || tracer.examples.length === 0) return { steps: [], input: '' };
  const example = tracer.examples[Math.min(exampleIndex, tracer.examples.length - 1)];
  const recorder = new Recorder(code);
  try {
    example.run(recorder);
  } catch (err) {
    recorder.step({
      explain: `This trace stopped early: ${(err as Error).message}`,
      tone: 'error',
      visuals: [],
    });
  }
  return { steps: recorder.steps, input: example.input };
}

export function SolutionView({ solution, tracer }: { solution: Solution; tracer: Tracer | undefined }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const timer = useRef<number>();

  const { steps, input } = useMemo(
    () => buildSteps(solution.code, tracer, exampleIndex),
    [solution.code, tracer, exampleIndex],
  );

  // A new problem (or example) always starts from the beginning, paused.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [solution.id, exampleIndex]);

  useEffect(() => {
    setExampleIndex(0);
  }, [solution.id]);

  useEffect(() => {
    if (!playing) return;
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), speed);
    return () => window.clearTimeout(timer.current);
  }, [playing, index, speed, steps.length]);

  const seek = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(i, Math.max(0, steps.length - 1))));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') target.blur();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(index - 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Home') {
        seek(0);
      } else if (e.key === 'End') {
        seek(steps.length - 1);
      } else if (e.key.toLowerCase() === 'r') {
        seek(0);
        setPlaying(true);
      } else if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, steps.length]);

  const step: Step | undefined = steps[index];

  if (!tracer || steps.length === 0) {
    return (
      <>
        <div className="workspace">
          <CodePanel code={solution.code} activeLines={[]} />
          <div className="panel">
            <div className="panel-head">Visualization</div>
            <div className="missing-tracer">
              <p style={{ fontSize: 15, color: 'var(--text)' }}>No trace for this solution yet.</p>
              <p>
                The Java source is on the left. Add a tracer in <code>src/tracers/</code> to bring this one to
                life — see <code>CONTRIBUTING.md</code>.
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: 16 }} />
      </>
    );
  }

  return (
    <>
      <div className="input-line">
        <span className="label">Input</span>
        <span>{input}</span>
        {tracer.examples.length > 1 && (
          <select
            className="example-select"
            value={exampleIndex}
            onChange={(e) => setExampleIndex(Number(e.target.value))}
            aria-label="Example input"
          >
            {tracer.examples.map((ex, i) => (
              <option key={ex.label} value={i}>
                {ex.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="workspace">
        <CodePanel code={solution.code} activeLines={step?.lines ?? []} />

        <div className="panel">
          <div className="panel-head">
            <span>Visualization</span>
            <span className="spacer" />
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>{solution.pattern}</span>
          </div>

          <div className="stage-scroll">
            {step?.visuals.map((viz, i) => (
              <VisualView viz={viz} key={`${index}-${i}-${viz.kind}`} />
            ))}
          </div>

          {step?.vars && Object.keys(step.vars).length > 0 && (
            <div className="vars-bar">
              {Object.entries(step.vars).map(([name, value]) => (
                <span className="var-pill" key={name}>
                  <span className="var-name">{name}</span>
                  <span className="var-value">{value === undefined ? '—' : String(value)}</span>
                </span>
              ))}
            </div>
          )}

          <div className={`explain-bar ${step?.tone ?? 'neutral'}`}>
            <span className="explain-icon">
              {step?.tone === 'success' ? '✓' : step?.tone === 'error' ? '✕' : step?.tone === 'warn' ? '!' : '›'}
            </span>
            <div>
              <div className="explain-text">{step?.explain}</div>
              {step?.result && <div className={`result-banner ${step.tone ?? 'neutral'}`}>{step.result}</div>}
            </div>
          </div>
        </div>
      </div>

      <Player
        index={index}
        total={steps.length}
        playing={playing}
        speed={speed}
        onSeek={seek}
        onTogglePlay={() => setPlaying((p) => !p)}
        onSpeed={setSpeed}
        onRestart={() => {
          setIndex(0);
          setPlaying(true);
        }}
      />
    </>
  );
}
