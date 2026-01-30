import { useCallback, useEffect, useMemo, useState } from 'react';

export type VirtualListOptions = {
  scrollRef: React.RefObject<HTMLElement | null>;
  constraintRef?: React.RefObject<HTMLElement | null>;
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
  const { scrollRef, constraintRef, itemCount, itemSize, overscan = 3 } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [constraintWidth, setConstraintWidth] = useState(0);

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

  // Handle scroll events
  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    // Set initial scroll position
    setScrollTop(el.scrollTop);

    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

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
