import {
  useCallback,
  useLayoutEffect,
  useRef,
  type RefObject,
  type UIEventHandler,
  type WheelEventHandler,
} from 'react';

const SCROLL_PANE_SELECTOR = '[data-diff-scroll-pane]';
const SCROLL_CONTROLLER_SELECTOR = '[data-diff-scroll-controller]';
const SHARED_CODE_WIDTH_PROPERTY = '--diff-code-scroll-width';
const SCROLL_CANVAS_WIDTH_PROPERTY = '--diff-scroll-canvas-width';
const SCROLL_OFFSET_PROPERTY = '--diff-code-scroll-left';

interface UseSynchronizedHorizontalScrollOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  resetKey: string;
  contentKey: unknown;
}

interface SynchronizedHorizontalScrollHandlers {
  onScrollCapture: UIEventHandler<HTMLElement>;
  onWheel: WheelEventHandler<HTMLElement>;
}

function getWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  viewportWidth: number,
  shiftKey: boolean,
): number {
  const delta = shiftKey && Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * viewportWidth;
  return delta;
}

export function useSynchronizedHorizontalScroll({
  containerRef,
  enabled,
  resetKey,
  contentKey,
}: UseSynchronizedHorizontalScrollOptions): SynchronizedHorizontalScrollHandlers {
  const maxScrollLeftRef = useRef(0);
  const smoothScrollTargetRef = useRef<number | null>(null);

  const getPanes = useCallback(
    () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(SCROLL_PANE_SELECTOR) ?? []),
    [containerRef],
  );

  const getController = useCallback(
    () => containerRef.current?.querySelector<HTMLElement>(SCROLL_CONTROLLER_SELECTOR) ?? null,
    [containerRef],
  );

  const setScrollOffset = useCallback(
    (scrollLeft: number) => {
      containerRef.current?.style.setProperty(SCROLL_OFFSET_PROPERTY, `${scrollLeft}px`);
    },
    [containerRef],
  );

  const refreshSharedScrollWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove the previous shared width before measuring so every rendered line
    // reports its intrinsic width. In split view, both sides participate in the
    // same maximum and therefore share one file-level canvas.
    container.style.removeProperty(SHARED_CODE_WIDTH_PROPERTY);

    const controller = getController();
    if (!enabled || !controller) {
      maxScrollLeftRef.current = 0;
      smoothScrollTargetRef.current = null;
      container.style.removeProperty(SCROLL_CANVAS_WIDTH_PROPERTY);
      container.style.removeProperty(SCROLL_OFFSET_PROPERTY);
      return;
    }

    const panes = getPanes();
    const sharedCodeWidth = panes.reduce((maximum, pane) => Math.max(maximum, pane.scrollWidth), 0);
    if (sharedCodeWidth <= 0) return;

    const maxScrollLeft = panes.reduce(
      (maximum, pane) =>
        pane.clientWidth > 0 ? Math.max(maximum, sharedCodeWidth - pane.clientWidth) : maximum,
      0,
    );
    const roundedCodeWidth = Math.ceil(sharedCodeWidth);
    const roundedMaxScrollLeft = Math.max(0, Math.ceil(maxScrollLeft));
    const controllerCanvasWidth = Math.ceil(controller.clientWidth + roundedMaxScrollLeft);

    maxScrollLeftRef.current = roundedMaxScrollLeft;
    container.style.setProperty(SHARED_CODE_WIDTH_PROPERTY, `${roundedCodeWidth}px`);
    container.style.setProperty(SCROLL_CANVAS_WIDTH_PROPERTY, `${controllerCanvasWidth}px`);

    const nextScrollLeft = Math.min(controller.scrollLeft, roundedMaxScrollLeft);
    if (controller.scrollLeft !== nextScrollLeft) controller.scrollLeft = nextScrollLeft;
    setScrollOffset(nextScrollLeft);

    const target = smoothScrollTargetRef.current;
    if (target !== null && target > roundedMaxScrollLeft) {
      smoothScrollTargetRef.current = roundedMaxScrollLeft;
    }
  }, [containerRef, enabled, getController, getPanes, setScrollOffset]);

  const onScrollCapture = useCallback<UIEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) return;
      const controller = getController();
      if (!controller || event.target !== controller) return;

      const scrollLeft = Math.max(0, Math.min(controller.scrollLeft, maxScrollLeftRef.current));
      setScrollOffset(scrollLeft);

      const target = smoothScrollTargetRef.current;
      if (target !== null && Math.abs(target - scrollLeft) < 0.5) {
        smoothScrollTargetRef.current = null;
      }
    },
    [enabled, getController, setScrollOffset],
  );

  const onWheel = useCallback<WheelEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) return;
      const hasHorizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (!hasHorizontalIntent) return;

      const controller = getController();
      const maxScrollLeft = maxScrollLeftRef.current;
      if (!controller || maxScrollLeft <= 0) return;

      const delta = getWheelDelta(
        event.deltaX,
        event.deltaY,
        event.deltaMode,
        controller.clientWidth,
        event.shiftKey,
      );
      if (delta === 0) return;

      const currentTarget = smoothScrollTargetRef.current ?? controller.scrollLeft;
      const nextTarget = Math.max(0, Math.min(maxScrollLeft, currentTarget + delta));
      smoothScrollTargetRef.current = nextTarget;
      event.preventDefault();
      controller.scrollTo({ left: nextTarget, behavior: 'smooth' });
    },
    [enabled, getController],
  );

  useLayoutEffect(() => {
    maxScrollLeftRef.current = 0;
    smoothScrollTargetRef.current = null;
    const controller = getController();
    if (controller) controller.scrollLeft = 0;
    setScrollOffset(0);
    refreshSharedScrollWidth();

    const container = containerRef.current;
    if (!enabled || !container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(refreshSharedScrollWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, enabled, getController, refreshSharedScrollWidth, resetKey, setScrollOffset]);

  // Expanding or collapsing a folded range mounts a different set of rows.
  // Re-measure all visible lines while preserving the controller's offset.
  useLayoutEffect(() => {
    if (enabled) refreshSharedScrollWidth();
  }, [contentKey, enabled, refreshSharedScrollWidth]);

  return { onScrollCapture, onWheel };
}
