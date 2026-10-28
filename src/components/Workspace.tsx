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
  // A share of the workspace width rather than pixels, so the code panel scales with the window.
  const [codeShare, setCodeShare] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem('codeShare'));
    return saved > 0 && saved < 1 ? saved : null;
  });

  useEffect(() => {
    localStorage.removeItem('codeWidth'); // the old pixel-based setting
    if (codeShare === null) localStorage.removeItem('codeShare');
    else localStorage.setItem('codeShare', codeShare.toFixed(4));
  }, [codeShare]);

  /** Width of the grid's content box: what a percentage track resolves against. */
  const innerWidth = () => {
    const el = ref.current;
    if (!el) return 0;
    const style = getComputedStyle(el);
    return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  };

  const resize = (px: number) => {
    const inner = innerWidth();
    if (inner <= 0) return;
    const gutter = ref.current?.querySelector<HTMLElement>('.resize-handle')?.offsetWidth ?? 0;
    setCodeShare(Math.max(MIN_CODE, Math.min(px, inner - gutter - MIN_VIZ)) / inner);
  };

  return (
    <div
      ref={ref}
      className={`workspace${showCode ? ' show-code' : ''}`}
      style={
        codeShare === null
          ? undefined
          // Both panels keep their minimums however small the window gets.
          : ({
              '--code-track': `clamp(${MIN_CODE}px, ${(codeShare * 100).toFixed(2)}%, calc(100% - ${MIN_VIZ + 16}px))`,
            } as CSSProperties)
      }
    >
      {code}
      <ResizeHandle
        label="Resize code and visualization panels"
        width={() => ref.current?.querySelector<HTMLElement>('.code-panel')?.offsetWidth ?? MIN_CODE}
        onResize={resize}
        onReset={() => setCodeShare(null)}
      />
      {viz}
    </div>
  );
}
