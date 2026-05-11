/**
 * Maximum length (in characters) of the user-supplied custom CSS for branding.
 * Bound enforced at the TRPC request boundary on both the organisation and
 * team settings update routes. The sanitiser is run after this check; this
 * limit is purely a request-size guard.
 *
 * 256 KB — generous enough for hand-written branding CSS and the occasional
 * compiled-from-Tailwind-or-similar paste, while still keeping a request
 * cap so a malicious or runaway payload can't exhaust PostCSS/server memory.
 */
export const BRANDING_CSS_MAX_LENGTH = 256 * 1024;
