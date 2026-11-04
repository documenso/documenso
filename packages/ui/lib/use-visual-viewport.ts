import { useSyncExternalStore } from 'react';

type VisualViewportRect = {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
  scale: number;
};

let cachedViewportRect: VisualViewportRect | null = null;

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return () => {};
  }

  window.visualViewport.addEventListener('resize', callback);
  window.visualViewport.addEventListener('scroll', callback);
  window.addEventListener('scroll', callback);
  window.addEventListener('resize', callback);

  return () => {
    window.visualViewport?.removeEventListener('resize', callback);
    window.visualViewport?.removeEventListener('scroll', callback);
    window.removeEventListener('scroll', callback);
    window.removeEventListener('resize', callback);
  };
};

const getSnapshot = (): VisualViewportRect | null => {
  const visualViewport = window.visualViewport;

  if (!visualViewport) {
    return null;
  }

  const nextViewportRect: VisualViewportRect = {
    offsetLeft: visualViewport.offsetLeft,
    offsetTop: visualViewport.offsetTop,
    width: visualViewport.width,
    height: visualViewport.height,
    scale: visualViewport.scale,
  };

  if (
    cachedViewportRect !== null &&
    cachedViewportRect.offsetLeft === nextViewportRect.offsetLeft &&
    cachedViewportRect.offsetTop === nextViewportRect.offsetTop &&
    cachedViewportRect.width === nextViewportRect.width &&
    cachedViewportRect.height === nextViewportRect.height &&
    cachedViewportRect.scale === nextViewportRect.scale
  ) {
    return cachedViewportRect;
  }

  cachedViewportRect = nextViewportRect;

  return cachedViewportRect;
};

const getServerSnapshot = (): null => null;

export const useVisualViewport = () => {
  return useSyncExternalStore<VisualViewportRect | null>(subscribe, getSnapshot, getServerSnapshot);
};