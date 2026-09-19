import { useEffect, useMemo, useRef } from 'react';
import { highlightJava } from '../lib/javaHighlight';

export function CodePanel({ code, activeLines }: { code: string; activeLines: number[] }) {
  const tokenLines = useMemo(() => highlightJava(code), [code]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hot = new Set(activeLines);
  const firstHot = activeLines.length ? Math.min(...activeLines) : 0;

  // Keep the executing line in view, but never yank the panel around when the
  // highlight is already comfortably visible.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !firstHot) return;
    const el = container.querySelector<HTMLElement>(`[data-line="${firstHot}"]`);
    if (!el) return;
    const top = el.offsetTop;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (top < viewTop + 40 || top > viewBottom - 80) {
      container.scrollTo({ top: Math.max(0, top - container.clientHeight / 2), behavior: 'smooth' });
    }
  }, [firstHot]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Java source</span>
        <span className="spacer" />
        <span style={{ textTransform: 'none', letterSpacing: 0 }}>
          {activeLines.length ? `line ${activeLines.join(', ')}` : '—'}
        </span>
      </div>
      <div className="code-scroll" ref={scrollRef}>
        {tokenLines.map((tokens, i) => {
          const lineNo = i + 1;
          return (
            <div className={`code-line${hot.has(lineNo) ? ' hot' : ''}`} key={lineNo} data-line={lineNo}>
              <span className="ln">{lineNo}</span>
              <span>
                {tokens.map((t, k) => (
                  <span className={`tok-${t.type}`} key={k}>
                    {t.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
