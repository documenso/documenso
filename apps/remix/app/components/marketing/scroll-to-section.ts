import type { MouseEvent } from 'react';

/**
 * Scrolls via JS instead of letting the browser handle the `href="#id"` navigation natively.
 * Real bug this works around: React Router's `<ScrollRestoration>` fights with the native
 * hash-triggered smooth scroll when a second in-page link is clicked before the first scroll
 * finishes, freezing the page partway between the two sections. The `href` is kept on the
 * anchor so it still works (as an instant jump) before hydration or with JS disabled.
 */
export function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
