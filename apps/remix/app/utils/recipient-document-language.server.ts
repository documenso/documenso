import { type SupportedLanguageCodes, isValidLanguageCode } from '@documenso/lib/constants/i18n';
import { prisma } from '@documenso/prisma';

/**
 * Matches the public recipient signing routes and captures the token:
 *   - `/sign/<token>`        (recipient signing — token lives on `Recipient`)
 *   - `/d/<token>`           (direct template link — token lives on `TemplateDirectLink`)
 *
 * Any trailing sub-path (`/sign/<token>/waiting`, `/complete`, ...) still
 * matches so the whole signing flow stays in the document's language.
 */
const SIGN_TOKEN_PATHNAME = /^\/sign\/([^/]+)(?:\/|$)/;
const DIRECT_TOKEN_PATHNAME = /^\/d\/([^/]+)(?:\/|$)/;

/**
 * Resolve the UI language for an anonymous recipient from the *document's*
 * configured language (`DocumentMeta.language`) instead of the browser's
 * `accept-language` header.
 *
 * Documenso normally derives the SSR locale from the `lang` cookie /
 * accept-language (see `extractLocaleData`), which leaves the public signing
 * page in English even when the document was created as e.g. `pt-BR`.
 *
 * This helper is intentionally scoped: it ONLY returns a language for the
 * recipient signing routes (`/sign/...`, `/d/...`). For every other route it
 * returns `null`, so the caller falls back to the existing locale resolution
 * and global behaviour is untouched.
 *
 * Returns a supported language code, or `null` when:
 *   - the request is not a signing route,
 *   - no document is found for the token,
 *   - the stored language is missing / not in `SUPPORTED_LANGUAGE_CODES`.
 */
export const getRecipientDocumentLanguage = async (
  request: Request,
): Promise<SupportedLanguageCodes | null> => {
  let token: string | null = null;
  let lookup: 'recipient' | 'directLink' | null = null;

  try {
    const { pathname } = new URL(request.url);

    const signMatch = pathname.match(SIGN_TOKEN_PATHNAME);
    if (signMatch) {
      token = decodeURIComponent(signMatch[1]);
      lookup = 'recipient';
    } else {
      const directMatch = pathname.match(DIRECT_TOKEN_PATHNAME);
      if (directMatch) {
        token = decodeURIComponent(directMatch[1]);
        lookup = 'directLink';
      }
    }
  } catch {
    return null;
  }

  if (!token || !lookup) {
    return null;
  }

  try {
    // Both lookups resolve the same path: token -> Envelope -> DocumentMeta.language.
    const language =
      lookup === 'recipient'
        ? await prisma.recipient
            .findFirst({
              where: { token },
              select: { envelope: { select: { documentMeta: { select: { language: true } } } } },
            })
            .then((r) => r?.envelope?.documentMeta?.language ?? null)
        : await prisma.templateDirectLink
            .findFirst({
              where: { token },
              select: { envelope: { select: { documentMeta: { select: { language: true } } } } },
            })
            .then((d) => d?.envelope?.documentMeta?.language ?? null);

    if (language && isValidLanguageCode(language)) {
      return language;
    }

    return null;
  } catch {
    // Never let an i18n lookup break the signing page render.
    return null;
  }
};
