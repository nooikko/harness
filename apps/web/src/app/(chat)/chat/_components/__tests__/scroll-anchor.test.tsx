import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollAnchor } from '../scroll-anchor';

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // jsdom does not define scrollIntoView — define it so spyOn can find it
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  // IntersectionObserver must be constructable (used with `new`)
  const MockIntersectionObserver = vi.fn().mockImplementation(function () {
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
    };
  });
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('ScrollAnchor', () => {
  it('renders a sentinel div', () => {
    const { container } = render(<ScrollAnchor messageCount={0} />);
    expect(container.querySelector('[data-scroll-anchor]')).not.toBeNull();
  });

  it('creates an IntersectionObserver on mount', () => {
    render(<ScrollAnchor messageCount={0} />);
    expect(IntersectionObserver).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<ScrollAnchor messageCount={0} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('calls scrollIntoView on mount for initial scroll', () => {
    const mockScrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(mockScrollIntoView);
    render(<ScrollAnchor messageCount={5} />);
    expect(mockScrollIntoView).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('scrolls to bottom when messageCount changes and user is near bottom', () => {
    const mockScrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(mockScrollIntoView);

    // Capture the observer callback so we can simulate intersection changes
    let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};

    class MockIO {
      observe = mockObserve;
      disconnect = mockDisconnect;
      constructor(cb: typeof observerCallback) {
        observerCallback = cb;
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIO);

    const { rerender } = render(<ScrollAnchor messageCount={1} />);

    // Simulate the sentinel being visible (user is near bottom)
    observerCallback([{ isIntersecting: true }]);

    mockScrollIntoView.mockClear();

    // Change messageCount — should trigger smooth scroll
    rerender(<ScrollAnchor messageCount={2} />);
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });

    vi.restoreAllMocks();
  });

  it('does not scroll when messageCount changes but user is not near bottom', () => {
    const mockScrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(mockScrollIntoView);

    let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};

    class MockIO {
      observe = mockObserve;
      disconnect = mockDisconnect;
      constructor(cb: typeof observerCallback) {
        observerCallback = cb;
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIO);

    const { rerender } = render(<ScrollAnchor messageCount={1} />);

    // Simulate the sentinel NOT being visible (user scrolled up)
    observerCallback([{ isIntersecting: false }]);

    mockScrollIntoView.mockClear();

    // Change messageCount — should NOT scroll
    rerender(<ScrollAnchor messageCount={2} />);
    expect(mockScrollIntoView).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('handles observer callback with empty entries array gracefully', () => {
    let observerCallback: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};

    class MockIO {
      observe = mockObserve;
      disconnect = mockDisconnect;
      constructor(cb: typeof observerCallback) {
        observerCallback = cb;
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIO);

    render(<ScrollAnchor messageCount={1} />);

    // Call with empty array — entry will be undefined, should not throw
    expect(() => observerCallback([])).not.toThrow();
  });

  it('does not scroll when messageCount stays the same on rerender', () => {
    const mockScrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(mockScrollIntoView);

    const { rerender } = render(<ScrollAnchor messageCount={3} />);
    mockScrollIntoView.mockClear();

    // Rerender with same count — should not trigger scroll
    rerender(<ScrollAnchor messageCount={3} />);
    expect(mockScrollIntoView).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
