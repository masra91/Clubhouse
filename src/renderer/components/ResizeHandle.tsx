import { useCallback, useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  collapsed?: boolean;
  collapseDirection?: 'left' | 'right' | 'up' | 'down';
}

export function ResizeHandle({
  direction,
  onResize,
  onResizeEnd,
  onDoubleClick,
  collapsed,
  collapseDirection,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lastPos = useRef(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const isHorizontal = direction === 'horizontal';

  const removeOverlay = useCallback(() => {
    if (overlayRef.current) {
      document.body.removeChild(overlayRef.current);
      overlayRef.current = null;
    }
  }, []);

  const addOverlay = useCallback(() => {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;cursor:' +
      (isHorizontal ? 'col-resize' : 'row-resize');
    document.body.appendChild(overlay);
    overlayRef.current = overlay;
  }, [isHorizontal, removeOverlay]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      lastPos.current = isHorizontal ? e.clientX : e.clientY;
      setDragging(true);
      addOverlay();
    },
    [isHorizontal, collapsed, addOverlay],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pos = isHorizontal ? e.clientX : e.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      if (delta !== 0) onResize(delta);
    },
    [dragging, isHorizontal, onResize],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragging(false);
      removeOverlay();
      onResizeEnd?.();
    },
    [dragging, onResizeEnd, removeOverlay],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 50 : 10;
      if (isHorizontal) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(-step); onResizeEnd?.(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onResize(step); onResizeEnd?.(); }
      } else {
        if (e.key === 'ArrowUp') { e.preventDefault(); onResize(-step); onResizeEnd?.(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onResize(step); onResizeEnd?.(); }
      }
      if (e.key === 'Enter' && onDoubleClick) {
        e.preventDefault();
        onDoubleClick();
      }
    },
    [isHorizontal, onResize, onResizeEnd, onDoubleClick],
  );

  const chevronChar = collapsed
    ? collapseDirection === 'left'
      ? '\u203A' // ›
      : collapseDirection === 'right'
        ? '\u2039' // ‹
        : collapseDirection === 'up'
          ? '\u203A'
          : '\u2039'
    : null;

  if (collapsed) {
    return (
      <div
        className={`flex-shrink-0 flex items-center justify-center cursor-pointer
          ${isHorizontal ? 'w-[11px]' : 'h-[11px]'}
          hover:bg-surface-0 transition-colors`}
        onClick={onDoubleClick}
        role="separator"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Expand pane"
      >
        <span className="text-ctp-subtext0 text-xs select-none">{chevronChar}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 relative group
        ${isHorizontal ? 'w-[11px] cursor-col-resize' : 'h-[11px] cursor-row-resize'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => !dragging && setHovered(false)}
      role="separator"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Resize ${direction}`}
    >
      {/* Visible line */}
      <div
        className={`absolute ${
          isHorizontal
            ? 'top-0 bottom-0 left-[5px] w-px'
            : 'left-0 right-0 top-[5px] h-px'
        } transition-colors ${
          dragging
            ? 'bg-indigo-500 ' + (isHorizontal ? 'w-[2px] left-[4.5px]' : 'h-[2px] top-[4.5px]')
            : hovered
              ? 'bg-surface-2'
              : 'bg-surface-0'
        }`}
      />
    </div>
  );
}
