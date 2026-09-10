import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import { useSynchronizedHorizontalScroll } from './useSynchronizedHorizontalScroll';

function setPaneDimensions(element: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
}

function Harness({ enabled = true, contentKey = 1 }: { enabled?: boolean; contentKey?: number }) {
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
        <span>left</span>
      </div>
      <div data-testid="right" data-diff-scroll-pane="right">
        <span data-testid="right-content">right</span>
      </div>
    </div>
  );
}

describe('useSynchronizedHorizontalScroll', () => {
  it('synchronizes native horizontal scrolling across both panes', () => {
    const { getByTestId } = render(<Harness />);
    const left = getByTestId('left');
    const right = getByTestId('right');

    left.scrollLeft = 120;
    fireEvent.scroll(left);

    expect(right.scrollLeft).toBe(120);
  });

  it('converts Shift + wheel into synchronized horizontal movement', () => {
    const { getByTestId } = render(<Harness />);
    const left = getByTestId('left');
    const right = getByTestId('right');
    setPaneDimensions(left, 200, 200);
    setPaneDimensions(right, 700, 200);

    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
    Object.defineProperties(wheelEvent, {
      shiftKey: { value: true },
      deltaX: { value: 0 },
      deltaY: { value: 80 },
      deltaMode: { value: WheelEvent.DOM_DELTA_PIXEL },
    });
    fireEvent(getByTestId('right-content'), wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(left.scrollLeft).toBe(80);
    expect(right.scrollLeft).toBe(80);
  });

  it('uses the longest line as a shared canvas width for every row', () => {
    const view = render(<Harness />);
    const left = view.getByTestId('left');
    const right = view.getByTestId('right');
    setPaneDimensions(left, 350, 200);
    setPaneDimensions(right, 900, 200);

    view.rerender(<Harness contentKey={2} />);

    expect(view.getByTestId('container').style.getPropertyValue('--diff-code-scroll-width')).toBe(
      '900px',
    );
  });

  it('leaves ordinary vertical scrolling and wrapped mode untouched', () => {
    const enabled = render(<Harness />);
    const enabledLeft = enabled.getByTestId('left');
    setPaneDimensions(enabledLeft, 500, 200);

    expect(fireEvent.wheel(enabledLeft, { deltaY: 80 })).toBe(true);
    expect(enabledLeft.scrollLeft).toBe(0);
    enabled.unmount();

    const wrapped = render(<Harness enabled={false} />);
    const wrappedLeft = wrapped.getByTestId('left');
    const wrappedRight = wrapped.getByTestId('right');
    setPaneDimensions(wrappedLeft, 500, 200);
    setPaneDimensions(wrappedRight, 500, 200);

    expect(fireEvent.wheel(wrappedLeft, { shiftKey: true, deltaY: 80 })).toBe(true);
    expect(wrappedLeft.scrollLeft).toBe(0);
    expect(wrappedRight.scrollLeft).toBe(0);
  });
});
