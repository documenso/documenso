import { useLayoutEffect, useRef } from 'react';

import { cn } from '../lib/utils';

export type Dimensions = {
  height: number;
  width: number;
};

export type AutoSizedTextProps = {
  children: React.ReactNode;
  className?: string;
  maxHeight?: number;
  useRem?: boolean;
};

const ITERATION_LIMIT = 20;
const MAXIMUM_DIFFERENCE = 1; // px

function getElementDimensions(element: HTMLElement): Dimensions {
  const bbox = element.getBoundingClientRect();

  return {
    width: bbox.width,
    height: bbox.height,
  };
}

function getBaseFontSize(): number {
  try {
    const fontSize = getComputedStyle(document.documentElement).fontSize;
    const parsed = parseFloat(fontSize);

    // Check if we got a valid number
    if (!Number.isFinite(parsed)) {
      return 16;
    }

    return parsed;
  } catch (error) {
    // Fallback to browser default if anything goes wrong
    return 16;
  }
}

function pxToRem(px: number): number {
  return px / getBaseFontSize();
}

export function AutoSizedText({
  children,
  className,
  maxHeight,
  useRem = false,
}: AutoSizedTextProps) {
  const childRef = useRef<HTMLDivElement>(null);

  const fontSize = useRef<number>(0);
  const fontSizeLowerBound = useRef<number>(0);
  const fontSizeUpperBound = useRef<number>(0);

  const adjustFontSize = (childDimensions: Dimensions, parentDimensions: Dimensions) => {
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

    let newFontSize: number;

    const targetHeight =
      maxHeight && maxHeight < parentDimensions.height ? maxHeight : parentDimensions.height;

    const isElementTooBig =
      childDimensions.width > parentDimensions.width || childDimensions.height > targetHeight;

    if (isElementTooBig) {
      // Scale down if element is bigger than target
      newFontSize = (fontSizeLowerBound.current + fontSize.current) / 2;
      fontSizeUpperBound.current = fontSize.current;
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // Scale up if element is smaller than target
      newFontSize = (fontSizeUpperBound.current + fontSize.current) / 2;
      fontSizeLowerBound.current = fontSize.current;
    }

    fontSize.current = newFontSize;

    // Convert to rem if useRem is true
    const displayFontSize = useRem ? `${pxToRem(newFontSize)}rem` : `${newFontSize}px`;
    childElement.style.fontSize = displayFontSize;
  };

  useLayoutEffect(() => {
    const childElement = childRef.current;
    const parentElement = childRef.current?.parentElement;

    if (!childElement || !parentElement) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const parentDimensions = entry.contentRect;

      // Reset iteration parameters
      fontSizeLowerBound.current = 0;
      fontSizeUpperBound.current = parentDimensions.height;

      let iterationCount = 0;

      while (iterationCount <= ITERATION_LIMIT) {
        const childDimensions = getElementDimensions(childElement);

        const targetHeight =
          maxHeight && maxHeight < parentDimensions.height ? maxHeight : parentDimensions.height;

        const widthDifference = parentDimensions.width - childDimensions.width;
        const heightDifference = targetHeight - childDimensions.height;

        const childFitsIntoParent = heightDifference >= 0 && widthDifference >= 0;
        const isWithinTolerance =
          Math.abs(widthDifference) <= MAXIMUM_DIFFERENCE ||
          Math.abs(heightDifference) <= MAXIMUM_DIFFERENCE;

        if (childFitsIntoParent && isWithinTolerance) {
          break;
        }

        adjustFontSize(childDimensions, parentDimensions);
        iterationCount += 1;
      }
    });

    observer.observe(parentElement);

    return () => {
      observer.disconnect();
    };
  }, [maxHeight, useRem]);

  return (
    <div ref={childRef} className={cn('inline-block leading-none', className)}>
      {children}
    </div>
  );
}
