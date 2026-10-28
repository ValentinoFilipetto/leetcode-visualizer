import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const MIN_CODE = 280;
const MIN_VIZ = 360;
const KEY_STEP = 24;

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
  const [dragging, setDragging] = useState(false);

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

  const currentWidth = () => ref.current?.querySelector<HTMLElement>('.code-panel')?.offsetWidth ?? MIN_CODE;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = currentWidth();
    setDragging(true);

    const onMove = (ev: PointerEvent) => setCodeWidth(clamp(startWidth + ev.clientX - startX));
    const onUp = () => {
      setDragging(false);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys step through the trace everywhere else; here they move the gutter.
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    setCodeWidth(clamp(currentWidth() + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP)));
  };

  return (
    <div
      ref={ref}
      className={`workspace${showCode ? ' show-code' : ''}${dragging ? ' resizing' : ''}`}
      style={
        codeWidth === null
          ? undefined
          // CSS re-clamps it, so shrinking the window never squeezes the visualization below MIN_VIZ.
          : ({ '--code-track': `clamp(${MIN_CODE}px, ${codeWidth}px, calc(100% - ${MIN_VIZ + 16}px))` } as CSSProperties)
      }
    >
      {code}
      <div
        className="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize code and visualization panels"
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={onPointerDown}
        onDoubleClick={() => setCodeWidth(null)}
        onKeyDown={onKeyDown}
      />
      {viz}
    </div>
  );
}
