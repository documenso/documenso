import type { Page } from '@playwright/test';

/**
 * Wait for React to hydrate the element matching the given selector.
 *
 * Filling controlled inputs before hydration is racy since React resets them
 * to their default values once it takes over the DOM. React attaches internal
 * fiber keys to DOM nodes during hydration, so their presence is a reliable
 * signal that the element is interactive.
 */
export const waitForHydration = async (page: Page, selector: string, timeout = 15_000) => {
  await page.waitForSelector(selector, { timeout });

  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);

      if (!element) {
        return false;
      }

      return Object.keys(element).some((key) => key.startsWith('__reactFiber'));
    },
    selector,
    { timeout },
  );
};
