/**
 * Returns the supplied CSP nonce only when rendering on the server.
 *
 * Browsers strip the `nonce` attribute from `getAttribute()` after CSP
 * processing for security (so reflected XSS can't read the nonce back out
 * of the DOM), but React 18's hydration reads via `getAttribute` and warns
 * about a mismatch when the JSX prop is non-empty:
 *
 *     Prop `nonce` did not match. Server: "" Client: "abc..."
 *
 * Returning `undefined` on the client makes React treat the prop as
 * "no attribute" — `shouldRemoveAttribute` short-circuits for nullish
 * values (see `react-dom/cjs/react-dom.development.js` `shouldRemoveAttribute`),
 * and the hydration prop-diff branch is skipped entirely.
 *
 * The nonce only matters at the moment the script/style is parsed by the
 * browser. After that it's an inert attribute, so dropping it on the
 * client has no functional impact. Subsequent dynamically-injected
 * scripts inherit trust via `'strict-dynamic'`.
 */
export const nonce = (value: string | undefined): string | undefined =>
  typeof window === 'undefined' ? value : '';
