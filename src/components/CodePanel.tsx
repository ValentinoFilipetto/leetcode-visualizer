import { useCallback, useEffect, useMemo, useRef } from 'react';
import { highlightJava } from '../lib/javaHighlight';

const TAB = 4;

type Tokens = ReturnType<typeof highlightJava>[number];

/**
 * Splits a line's leading whitespace off its tokens and measures it in columns,
 * so a wrapped line can hang its continuation one level deeper than its start.
 */
function splitIndent(tokens: Tokens): { indent: number; tokens: Tokens } {
  let indent = 0;
  const rest = tokens.slice();
  while (rest.length) {
    const lead = rest[0].text.match(/^[ \t]*/)![0];
    for (const ch of lead) indent = ch === '\t' ? indent + TAB - (indent % TAB) : indent + 1;
    if (lead.length < rest[0].text.length) {
      rest[0] = { ...rest[0], text: rest[0].text.slice(lead.length) };
      break;
    }
    rest.shift();
  }
  return { indent, tokens: rest };
}

export function CodePanel({ code, activeLines }: { code: string; activeLines: number[] }) {
  const tokenLines = useMemo(() => highlightJava(code).map(splitIndent), [code]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hot = new Set(activeLines);
  const firstHot = activeLines.length ? Math.min(...activeLines) : 0;

  // Keep the executing line in view, but never yank the panel around when the
  // highlight is already comfortably visible.
  const centerOnHot = useCallback(
    (behavior: ScrollBehavior) => {
      const container = scrollRef.current;
      if (!container || !firstHot || container.clientHeight === 0) return;
      const el = container.querySelector<HTMLElement>(`[data-line="${firstHot}"]`);
      if (!el) return;
      const top = el.offsetTop;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (top < viewTop + 40 || top > viewBottom - 80) {
        container.scrollTo({ top: Math.max(0, top - container.clientHeight / 2), behavior });
      }
    },
    [firstHot],
  );

  useEffect(() => {
    centerOnHot('smooth');
  }, [centerOnHot]);

  // On mobile this panel is display:none until the user asks for the source, and
  // scrolling a hidden element does nothing — so centre again the moment it gets
  // a size, whether from the toggle or from a resize across the breakpoint.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let wasVisible = container.clientHeight > 0;
    const observer = new ResizeObserver(() => {
      const visible = container.clientHeight > 0;
      if (visible && !wasVisible) centerOnHot('auto');
      wasVisible = visible;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [centerOnHot]);

  return (
    <div className="panel code-panel">
      <div className="panel-head">
        <span>Java source</span>
        <span className="spacer" />
        <span style={{ textTransform: 'none', letterSpacing: 0 }}>
          {activeLines.length ? `line ${activeLines.join(', ')}` : '—'}
        </span>
      </div>
      <div className="code-scroll" ref={scrollRef}>
        {tokenLines.map(({ indent, tokens }, i) => {
          const lineNo = i + 1;
          return (
            <div className={`code-line${hot.has(lineNo) ? ' hot' : ''}`} key={lineNo} data-line={lineNo}>
              <span className="ln">{lineNo}</span>
              {/* The indent becomes padding, and a negative text-indent pulls only the
                  first visual row back out: wrapped rows hang one level deeper. */}
              <span className="code-text" style={{ paddingLeft: `${indent + TAB}ch`, textIndent: `-${TAB}ch` }}>
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
