import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useSynchronizedHorizontalScroll } from './useSynchronizedHorizontalScroll';

function setDimensions(element: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
}

function Harness({
  enabled = true,
  contentKey = 1,
  expanded = false,
}: {
  enabled?: boolean;
  contentKey?: number;
  expanded?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlers = useSynchronizedHorizontalScroll({
    containerRef,
    enabled,
    resetKey: 'file.ts',
    contentKey,
  });

  return (
    <div ref={containerRef} data-testid="container" {...handlers}>
      <div data-testid="left" data-diff-scroll-pane="left">
        <span className="diff-code-scroll-content">left</span>
      </div>
      <div data-testid="right" data-diff-scroll-pane="right">
        <span className="diff-code-scroll-content" data-testid="right-content">
          right
        </span>
      </div>
      {expanded && (
        <div data-testid="expanded" data-diff-scroll-pane="left">
          <span className="diff-code-scroll-content">expanded line</span>
        </div>
      )}
      <div data-diff-scroll-controller="true" data-testid="controller">
        <div className="diff-file-scroll-canvas" />
      </div>
    </div>
  );
}

function prepareCanvas(
  view: ReturnType<typeof render>,
  {
    leftWidth = 350,
    rightWidth = 900,
    contentKey = 2,
  }: { leftWidth?: number; rightWidth?: number; contentKey?: number } = {},
) {
  setDimensions(view.getByTestId('left'), leftWidth, 200);
  setDimensions(view.getByTestId('right'), rightWidth, 200);
  setDimensions(view.getByTestId('controller'), 1200, 500);
  view.rerender(<Harness contentKey={contentKey} />);
}

describe('useSynchronizedHorizontalScroll', () => {
  it('moves one file-level canvas without changing per-line scroll positions', () => {
    const view = render(<Harness />);
    prepareCanvas(view);
    const controller = view.getByTestId('controller');

    controller.scrollLeft = 120;
    fireEvent.scroll(controller);

    expect(view.getByTestId('container').style.getPropertyValue('--diff-code-scroll-left')).toBe(
      '120px',
    );
    expect(view.getByTestId('left').scrollLeft).toBe(0);
    expect(view.getByTestId('right').scrollLeft).toBe(0);
  });

  it('uses native smooth scrolling for Shift + wheel and accumulates its target', () => {
    const view = render(<Harness />);
    prepareCanvas(view);
    const controller = view.getByTestId('controller');
    const scrollTo = vi.fn();
    Object.defineProperty(controller, 'scrollTo', { configurable: true, value: scrollTo });

    const createShiftWheelEvent = () => {
      const event = new Event('wheel', { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        shiftKey: { value: true },
        deltaX: { value: 0 },
        deltaY: { value: 80 },
        deltaMode: { value: WheelEvent.DOM_DELTA_PIXEL },
      });
      return event;
    };

    const firstWheelEvent = createShiftWheelEvent();
    fireEvent(view.getByTestId('right-content'), firstWheelEvent);
    expect(firstWheelEvent.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 80, behavior: 'smooth' });

    fireEvent(view.getByTestId('right-content'), createShiftWheelEvent());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 160, behavior: 'smooth' });

    controller.scrollLeft = 60;
    fireEvent.scroll(controller);
    expect(view.getByTestId('container').style.getPropertyValue('--diff-code-scroll-left')).toBe(
      '60px',
    );
  });

  it('shares the widest split-side line and remeasures after expanding or collapsing rows', () => {
    const view = render(<Harness />);
    prepareCanvas(view);
    const container = view.getByTestId('container');

    expect(container.style.getPropertyValue('--diff-code-scroll-width')).toBe('900px');
    expect(container.style.getPropertyValue('--diff-scroll-canvas-width')).toBe('1200px');

    view.rerender(<Harness contentKey={3} expanded />);
    setDimensions(view.getByTestId('expanded'), 1200, 200);
    view.rerender(<Harness contentKey={4} expanded />);

    expect(container.style.getPropertyValue('--diff-code-scroll-width')).toBe('1200px');
    expect(container.style.getPropertyValue('--diff-scroll-canvas-width')).toBe('1500px');

    const controller = view.getByTestId('controller');
    controller.scrollLeft = 900;
    view.rerender(<Harness contentKey={5} />);

    expect(container.style.getPropertyValue('--diff-code-scroll-width')).toBe('900px');
    expect(container.style.getPropertyValue('--diff-scroll-canvas-width')).toBe('1200px');
    expect(controller.scrollLeft).toBe(700);
    expect(container.style.getPropertyValue('--diff-code-scroll-left')).toBe('700px');
  });

  it('leaves ordinary vertical scrolling and wrapped mode untouched', () => {
    const enabled = render(<Harness />);
    prepareCanvas(enabled);

    expect(fireEvent.wheel(enabled.getByTestId('left'), { deltaY: 80 })).toBe(true);
    expect(enabled.getByTestId('container').style.getPropertyValue('--diff-code-scroll-left')).toBe(
      '0px',
    );
    enabled.unmount();

    const wrapped = render(<Harness enabled={false} />);
    setDimensions(wrapped.getByTestId('left'), 500, 200);
    setDimensions(wrapped.getByTestId('right'), 500, 200);

    expect(fireEvent.wheel(wrapped.getByTestId('left'), { shiftKey: true, deltaY: 80 })).toBe(true);
    expect(
      wrapped.getByTestId('container').style.getPropertyValue('--diff-code-scroll-width'),
    ).toBe('');
  });
});
