import {
  useCallback,
  useLayoutEffect,
  useRef,
  type RefObject,
  type UIEventHandler,
  type WheelEventHandler,
} from 'react';

const SCROLL_PANE_SELECTOR = '[data-diff-scroll-pane]';
const SHARED_SCROLL_WIDTH_PROPERTY = '--diff-code-scroll-width';

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

function getScrollPane(target: EventTarget | null, container: HTMLElement): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const pane = target.closest<HTMLElement>(SCROLL_PANE_SELECTOR);
  return pane && container.contains(pane) ? pane : null;
}

function getWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  viewportWidth: number,
): number {
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
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
  const scrollLeftRef = useRef(0);
  const expectedScrollPositionsRef = useRef(new WeakMap<HTMLElement, number>());

  const getPanes = useCallback(
    () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(SCROLL_PANE_SELECTOR) ?? []),
    [containerRef],
  );

  const synchronize = useCallback(
    (requestedScrollLeft: number, source?: HTMLElement) => {
      const scrollLeft = Math.max(0, requestedScrollLeft);
      scrollLeftRef.current = scrollLeft;

      getPanes().forEach((pane) => {
        if (pane === source || pane.scrollLeft === scrollLeft) return;
        pane.scrollLeft = scrollLeft;
        // Browsers clamp short lines to their own maximum. Record the actual
        // value so the resulting programmatic scroll event is not mistaken for
        // a new user gesture that should pull every other line backwards.
        expectedScrollPositionsRef.current.set(pane, pane.scrollLeft);
      });
    },
    [getPanes],
  );

  const refreshSharedScrollWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Measure every line at its intrinsic width first. The largest line then
    // becomes a shared canvas width, giving short lines the same horizontal
    // range instead of letting the browser clamp their scrollLeft to zero.
    container.style.removeProperty(SHARED_SCROLL_WIDTH_PROPERTY);
    if (!enabled) return;

    const panes = getPanes();
    const sharedWidth = panes.reduce((maximum, pane) => Math.max(maximum, pane.scrollWidth), 0);
    if (sharedWidth > 0) {
      container.style.setProperty(SHARED_SCROLL_WIDTH_PROPERTY, `${Math.ceil(sharedWidth)}px`);
    }

    const maxScrollLeft = panes.reduce(
      (maximum, pane) => Math.max(maximum, pane.scrollWidth - pane.clientWidth),
      0,
    );
    synchronize(Math.min(scrollLeftRef.current, maxScrollLeft));
  }, [containerRef, enabled, getPanes, synchronize]);

  const onScrollCapture = useCallback<UIEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled) return;
      const container = containerRef.current;
      if (!container) return;
      const pane = getScrollPane(event.target, container);
      if (!pane) return;

      const expected = expectedScrollPositionsRef.current.get(pane);
      if (expected !== undefined) {
        expectedScrollPositionsRef.current.delete(pane);
        if (expected === pane.scrollLeft) return;
      }

      synchronize(pane.scrollLeft, pane);
    },
    [containerRef, enabled, synchronize],
  );

  const onWheel = useCallback<WheelEventHandler<HTMLElement>>(
    (event) => {
      if (!enabled || !event.shiftKey) return;
      const container = containerRef.current;
      if (!container) return;
      const pane = getScrollPane(event.target, container);
      if (!pane) return;
      refreshSharedScrollWidth();
      const delta = getWheelDelta(event.deltaX, event.deltaY, event.deltaMode, pane.clientWidth);
      if (delta === 0) return;

      const panes = getPanes();
      const maxScrollLeft = panes.reduce(
        (maximum, pane) => Math.max(maximum, pane.scrollWidth - pane.clientWidth),
        0,
      );
      if (maxScrollLeft <= 0) return;

      event.preventDefault();
      synchronize(Math.min(maxScrollLeft, scrollLeftRef.current + delta));
    },
    [containerRef, enabled, getPanes, refreshSharedScrollWidth, synchronize],
  );

  useLayoutEffect(() => {
    scrollLeftRef.current = 0;
    expectedScrollPositionsRef.current = new WeakMap();
    refreshSharedScrollWidth();

    const container = containerRef.current;
    if (!enabled || !container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(refreshSharedScrollWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, enabled, refreshSharedScrollWidth, resetKey]);

  // Expanding folded ranges mounts new scroll panes. Bring them to the
  // existing file-level offset without resetting the user's position.
  useLayoutEffect(() => {
    if (enabled) refreshSharedScrollWidth();
  }, [contentKey, enabled, refreshSharedScrollWidth]);

  return { onScrollCapture, onWheel };
}
