import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ScrollTarget = React.RefObject<HTMLElement | null> | 'window';

export type VirtualListOptions = {
  scrollRef: ScrollTarget;
  constraintRef?: React.RefObject<HTMLElement | null>;

  /**
   * Ref to the element that contains the virtual list content.
   *
   * Used to calculate the offset between the scroll container and the virtual
   * list when the scroll container is a parent element higher in the DOM tree.
   *
   * When the virtual list is not at the top of the scroll container (e.g. there
   * are headers, alerts, or other content above it), this offset ensures the
   * scroll position is correctly adjusted for virtualization calculations.
   */
  contentRef?: React.RefObject<HTMLElement | null>;

  itemCount: number;
  itemSize: number | ((index: number, constraintWidth: number) => number);
  overscan?: number;
};

export type VirtualItem = {
  index: number;
  start: number;
  size: number;
  key: string;
};

export type VirtualListResult = {
  virtualItems: VirtualItem[];
  totalSize: number;
  constraintWidth: number;
};

/**
 * A minimal list virtualizer hook that supports fixed item sizes and external scroll containers.
 *
 * @param options - Configuration options for the virtual list
 * @returns Virtual items to render, total size, and constraint width
 */
export const useVirtualList = (options: VirtualListOptions): VirtualListResult => {
  const { scrollRef, constraintRef, contentRef, itemCount, itemSize, overscan = 3 } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [constraintWidth, setConstraintWidth] = useState(0);

  /**
   * The offset of the content element relative to the scroll container.
   *
   * This is recalculated on scroll to handle cases where dynamic content
   * above the virtual list changes size.
   */
  const contentOffsetRef = useRef(0);

  // Track constraint element width with ResizeObserver
  useEffect(() => {
    const el = constraintRef?.current;

    if (!el) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        setConstraintWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);

    // Set initial width
    setConstraintWidth(el.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [constraintRef]);

  // Track scroll container dimensions with ResizeObserver
  useEffect(() => {
    if (scrollRef === 'window') {
      const handleResize = () => {
        setViewportHeight(window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      // Set initial height
      setViewportHeight(window.innerHeight);

      return () => window.removeEventListener('resize', handleResize);
    }

    const el = scrollRef.current;

    if (!el) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        setViewportHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);

    // Set initial height
    setViewportHeight(el.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, [scrollRef]);

  // Handle scroll events and calculate content offset
  useEffect(() => {
    if (scrollRef === 'window') {
      const calculateOffset = () => {
        const contentEl = contentRef?.current;

        if (!contentEl) {
          contentOffsetRef.current = 0;
          return;
        }

        // For window scrolling, the offset is the distance from the top of the
        // content element to the top of the document, which is its bounding rect
        // top plus the current scroll position.
        contentOffsetRef.current = contentEl.getBoundingClientRect().top + window.scrollY;
      };

      const handleScroll = () => {
        calculateOffset();

        const adjustedScrollTop = Math.max(0, window.scrollY - contentOffsetRef.current);
        setScrollTop(adjustedScrollTop);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });

      // Set initial values
      calculateOffset();
      const adjustedScrollTop = Math.max(0, window.scrollY - contentOffsetRef.current);
      setScrollTop(adjustedScrollTop);

      return () => window.removeEventListener('scroll', handleScroll);
    }

    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    const calculateOffset = () => {
      const contentEl = contentRef?.current;

      if (!contentEl) {
        contentOffsetRef.current = 0;
        return;
      }

      const scrollRect = scrollEl.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();

      // The offset is the distance from the top of the content element to
      // the top of the scroll container, adjusted for current scroll position.
      contentOffsetRef.current = contentRect.top - scrollRect.top + scrollEl.scrollTop;
    };

    const handleScroll = () => {
      calculateOffset();

      const adjustedScrollTop = Math.max(0, scrollEl.scrollTop - contentOffsetRef.current);
      setScrollTop(adjustedScrollTop);
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });

    // Set initial values
    calculateOffset();
    const adjustedScrollTop = Math.max(0, scrollEl.scrollTop - contentOffsetRef.current);
    setScrollTop(adjustedScrollTop);

    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [scrollRef, contentRef]);

  // Get item size helper
  const getItemSize = useCallback(
    (index: number): number => {
      if (typeof itemSize === 'function') {
        return itemSize(index, constraintWidth);
      }

      return itemSize;
    },
    [itemSize, constraintWidth],
  );

  // Precompute item offsets for O(1) lookup
  const { offsets, totalSize } = useMemo(() => {
    const result: number[] = [];
    let offset = 0;

    for (let i = 0; i < itemCount; i++) {
      result.push(offset);
      offset += getItemSize(i);
    }

    return { offsets: result, totalSize: offset };
  }, [itemCount, getItemSize]);

  // Binary search to find the first visible item
  const findStartIndex = useCallback(
    (scrollTop: number): number => {
      let low = 0;
      let high = itemCount - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const offset = offsets[mid];

        if (offset < scrollTop) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      return Math.max(0, low - 1);
    },
    [offsets, itemCount],
  );

  // Calculate virtual items to render
  const virtualItems = useMemo((): VirtualItem[] => {
    if (itemCount === 0 || constraintWidth === 0) {
      return [];
    }

    const startIndex = findStartIndex(scrollTop);
    const items: VirtualItem[] = [];

    // Apply overscan before visible area
    const overscanStart = Math.max(0, startIndex - overscan);

    // Find items within the visible area + overscan
    for (let i = overscanStart; i < itemCount; i++) {
      const start = offsets[i];
      const size = getItemSize(i);

      // Stop if we've gone past the visible area + overscan
      if (start > scrollTop + viewportHeight) {
        // Add overscan items after visible area
        const overscanEnd = Math.min(itemCount, i + overscan);

        for (let j = i; j < overscanEnd; j++) {
          items.push({
            index: j,
            start: offsets[j],
            size: getItemSize(j),
            key: `virtual-item-${j}`,
          });
        }

        break;
      }

      items.push({
        index: i,
        start,
        size,
        key: `virtual-item-${i}`,
      });
    }

    return items;
  }, [
    itemCount,
    constraintWidth,
    scrollTop,
    viewportHeight,
    overscan,
    offsets,
    getItemSize,
    findStartIndex,
  ]);

  return {
    virtualItems,
    totalSize,
    constraintWidth,
  };
};
