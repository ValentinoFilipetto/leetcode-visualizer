import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ResizeHandle } from './ResizeHandle';

const MIN_CODE = 280;
const MIN_VIZ = 360;

/**
 * The code panel and the visualization side by side, with a draggable gutter
 * between them. The width lives in a CSS variable, so the stacked tablet and
 * phone layouts simply ignore it.
 */
export function Workspace({ showCode, code, viz }: { showCode: boolean; code: ReactNode; viz: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [codeWidth, setCodeWidth] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem('codeWidth'));
    return saved > 0 ? saved : null;
  });

  useEffect(() => {
    if (codeWidth === null) localStorage.removeItem('codeWidth');
    else localStorage.setItem('codeWidth', String(Math.round(codeWidth)));
  }, [codeWidth]);

  const clamp = (px: number) => {
    const el = ref.current;
    if (!el) return px;
    const style = getComputedStyle(el);
    const inner = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gutter = el.querySelector<HTMLElement>('.resize-handle')?.offsetWidth ?? 0;
    return Math.max(MIN_CODE, Math.min(px, inner - gutter - MIN_VIZ));
  };

  return (
    <div
      ref={ref}
      className={`workspace${showCode ? ' show-code' : ''}`}
      style={
        codeWidth === null
          ? undefined
          // CSS re-clamps it, so shrinking the window never squeezes the visualization below MIN_VIZ.
          : ({ '--code-track': `clamp(${MIN_CODE}px, ${codeWidth}px, calc(100% - ${MIN_VIZ + 16}px))` } as CSSProperties)
      }
    >
      {code}
      <ResizeHandle
        label="Resize code and visualization panels"
        width={() => ref.current?.querySelector<HTMLElement>('.code-panel')?.offsetWidth ?? MIN_CODE}
        onResize={(px) => setCodeWidth(clamp(px))}
        onReset={() => setCodeWidth(null)}
      />
      {viz}
    </div>
  );
}
