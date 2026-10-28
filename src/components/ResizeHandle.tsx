import { useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

const KEY_STEP = 24;

/**
 * A vertical drag handle. It only reports widths: the owner decides what to
 * resize, clamps the value and stores it.
 */
export function ResizeHandle({
  className = '',
  label,
  width,
  onResize,
  onReset,
}: {
  className?: string;
  label: string;
  /** Current width of the thing being resized, read at the start of each drag. */
  width: () => number;
  onResize: (px: number) => void;
  onReset: () => void;
}) {
  const [active, setActive] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = width();
    setActive(true);
    document.body.classList.add('col-resizing');

    const onMove = (ev: PointerEvent) => onResize(startWidth + ev.clientX - startX);
    const onUp = () => {
      setActive(false);
      document.body.classList.remove('col-resizing');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys step through the trace everywhere else; here they move the handle.
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    onResize(width() + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
  };

  return (
    <div
      className={`resize-handle${active ? ' active' : ''} ${className}`.trim()}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
