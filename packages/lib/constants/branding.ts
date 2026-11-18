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

/**
 * Branding logo upload constraints. Enforced server-side at the TRPC request
 * boundary (`zfdBrandingImageFile`) and reused by the client form for matching UX.
 */
export const BRANDING_LOGO_MAX_SIZE_MB = 5;

export const BRANDING_LOGO_MAX_SIZE_BYTES = BRANDING_LOGO_MAX_SIZE_MB * 1024 * 1024;

export const BRANDING_LOGO_ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp'];
