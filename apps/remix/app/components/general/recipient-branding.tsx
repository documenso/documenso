import type { TCssVarsSchema } from '@documenso/lib/types/css-vars';
import { useEffect } from 'react';

import { toNativeCssVarsString } from '~/utils/css-vars';

export type RecipientBrandingPayload = {
  allowCustomBranding: boolean;
  colors?: TCssVarsSchema | null;
  css?: string | null;
};

export type RecipientBrandingProps = {
  branding: RecipientBrandingPayload | null | undefined;
  cspNonce: string | undefined;
};

/**
 * Renders a `<style nonce>` block for a recipient route, scoped to the
 * `.documenso-branded` wrapper rendered in `_recipient+/_layout.tsx`.
 *
 * Both the CSS variables (from `branding.colors`) and the user's custom CSS
 * (from `branding.css`) are emitted inside a single nested rule so the user
 * doesn't need to scope their own selectors — native CSS nesting handles it:
 *
 *   .documenso-branded {
 *     --background: ...;
 *     .my-class { color: red; }
 *   }
 *
 * Equivalent to `.documenso-branded .my-class { color: red; }` after expansion.
 *
 * The user's CSS is sanitised at write time (`sanitizeBrandingCss`) and stored
 * in the DB as-is — no per-render parsing.
 *
 * Why both SSR `<style>` and a `useEffect` injection?
 *
 * The rendered `<style>` covers the initial server render so the first paint
 * already has the branding applied — without it, the page would flash the
 * default theme before hydration.
 *
 * The `useEffect` covers in-app client-side navigations. When the user
 * navigates between recipient routes via the router, the server render
 * doesn't run again, so React reconciles the existing DOM. If the loader
 * data changes (e.g. a different recipient with different branding), the
 * SSR'd `<style>` from the previous page may persist or be reused, leading
 * to stale or inconsistent branding. Appending a fresh `<style>` to
 * `document.head` and removing it on cleanup guarantees the active branding
 * matches the current route on both initial load and subsequent navigations.
 */
export const RecipientBranding = ({ branding, cspNonce }: RecipientBrandingProps) => {
  const varsString = toNativeCssVarsString(branding?.colors ?? {});

  const userCss = branding?.css ?? '';

  const hasVars = varsString.trim().length > 0;
  const hasUserCss = userCss.trim().length > 0;

  const innerBody = `${hasVars ? `${varsString}\n` : ''}${hasUserCss ? userCss : ''}`.trim();
  const css = `.documenso-branded { ${innerBody} }`;

  useEffect(() => {
    if (!branding?.allowCustomBranding) {
      return;
    }

    if (!hasVars && !hasUserCss) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('nonce', cspNonce ?? '');
    style.textContent = css;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [branding, cspNonce, css, hasUserCss, hasVars]);

  if (!branding?.allowCustomBranding) {
    return null;
  }

  if (!hasVars && !hasUserCss) {
    return null;
  }

  return <style nonce={cspNonce}>{css}</style>;
};
