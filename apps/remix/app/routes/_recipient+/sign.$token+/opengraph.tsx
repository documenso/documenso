import fs from 'node:fs/promises';
import path from 'node:path';
import { getI18nInstance } from '@documenso/lib/client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { svgToPng } from '@documenso/lib/utils/images/svg-to-png';
import { isRecipientExpired } from '@documenso/lib/utils/recipients';
import { msg } from '@lingui/core/macro';
import { DocumentStatus, SigningStatus } from '@prisma/client';
import satori from 'satori';

import type { Route } from './+types/opengraph';

const IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

const MAX_TITLE_LENGTH = 80;
const MAX_NAME_LENGTH = 48;

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

/**
 * Fonts and static images are read from disk rather than fetched over HTTP so
 * the endpoint does not depend on its own public URL being reachable.
 *
 * Reads are memoised per process, mirroring `ensureFontLibrary` in
 * `packages/lib/server-only/pdf/helpers.ts`.
 */
const assetCache = new Map<string, Promise<Buffer>>();

const loadAsset = (relativePath: string): Promise<Buffer> => {
  const cached = assetCache.get(relativePath);

  if (cached) {
    return cached;
  }

  const pending = fs.readFile(path.join(process.cwd(), 'public', relativePath));

  assetCache.set(relativePath, pending);

  // Don't cache a rejected read, otherwise a transient failure is permanent.
  pending.catch(() => assetCache.delete(relativePath));

  return pending;
};

/**
 * Inter cannot render Chinese, Japanese or Korean glyphs, so we register the
 * matching Noto Sans family as a fallback for those document languages.
 *
 * `noto-sans-japanese.ttf` and `noto-sans-korean.ttf` are variable fonts, which
 * satori's opentype parser cannot read (it throws on the `fvar` table), so
 * those languages fall back to the generic image until static builds of those
 * faces are added to `public/fonts`.
 */
const CJK_FONTS: Record<string, { family: string; file: string } | null> = {
  zh: { family: 'Noto Sans Chinese', file: 'fonts/noto-sans-chinese.ttf' },
  ja: null,
  ko: null,
};

const isCjkLanguage = (language: string) => language in CJK_FONTS;

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { token } = params;

  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();

  // Anything that isn't an actionable signing request falls back to the
  // site-wide image rather than leaking document details or claiming a
  // signature is requested when it no longer is.
  const genericImageResponse = () =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/opengraph-image.jpg`,
        'Cache-Control': 'public, max-age=300',
      },
    });

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const document = await getDocumentAndSenderByToken({
      token,
      requireAccessAuth: false,
    }).catch(() => null);

    if (!document) {
      return new Response('Not found', { status: 404 });
    }

    // Matches the 404 in the signing page loader — a draft has no shareable link.
    if (document.status === DocumentStatus.DRAFT || document.deletedAt) {
      return new Response('Not found', { status: 404 });
    }

    const recipient = document.recipients[0];

    if (!recipient) {
      return new Response('Not found', { status: 404 });
    }

    // The signing page hides everything behind an auth gate when access auth is
    // required. The crawler has no session, so it must not see more than that.
    const { recipientAccessAuthRequired } = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    if (recipientAccessAuthRequired) {
      return genericImageResponse();
    }

    // Mirrors the redirects in the signing page loader — these states render
    // their own pages, none of which are a signature request.
    const isActionableSigningRequest =
      document.status === DocumentStatus.PENDING &&
      recipient.signingStatus === SigningStatus.NOT_SIGNED &&
      !isRecipientExpired(recipient);

    if (!isActionableSigningRequest) {
      return genericImageResponse();
    }

    const language = document.documentMeta?.language ?? 'en';
    const cjkFont = CJK_FONTS[language] ?? null;

    // A language we can't render legibly is worse than the generic image.
    if (isCjkLanguage(language) && !cjkFont) {
      return genericImageResponse();
    }

    const [interRegular, interSemiBold, interBold, cjkFontData, logo] = await Promise.all([
      loadAsset('fonts/inter-regular.ttf'),
      loadAsset('fonts/inter-semibold.ttf'),
      loadAsset('fonts/inter-bold.ttf'),
      cjkFont ? loadAsset(cjkFont.file) : Promise.resolve(null),
      loadAsset('static/logo.png'),
    ]);

    const sender = truncate(document.user.name || document.user.email, MAX_NAME_LENGTH);
    const recipientName = recipient.name || recipient.email;
    const documentTitle = truncate(document.title, MAX_TITLE_LENGTH);

    const i18n = await getI18nInstance(language);

    const labels = {
      badge: i18n._(msg`Signature requested`),
      headline: i18n._(msg`${sender} has sent you a document to sign`),
      documentLabel: i18n._(msg`Document`),
      forRecipient: recipientName ? i18n._(msg`For ${truncate(recipientName, MAX_NAME_LENGTH)}`) : null,
      cta: i18n._(msg`Sign document`),
    };

    const fontFamily = cjkFont ? `Inter, ${cjkFont.family}` : 'Inter';

    const svg = await satori(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          backgroundColor: '#ffffff',
          padding: '72px 80px',
          fontFamily,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              backgroundColor: '#a2e771',
            }}
          />
          <span
            style={{
              color: '#6b7280',
              fontSize: '22px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {labels.badge}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '40px',
          }}
        >
          <p
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              color: '#0f172a',
              fontSize: '52px',
              fontWeight: 700,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {labels.headline}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '40px',
            padding: '28px 32px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          <span
            style={{
              color: '#64748b',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {labels.documentLabel}
          </span>
          <span
            style={{
              color: '#0f172a',
              fontSize: '34px',
              fontWeight: 600,
              marginTop: '8px',
            }}
          >
            {documentTitle}
          </span>
          {labels.forRecipient ? (
            <span
              style={{
                color: '#475569',
                fontSize: '22px',
                marginTop: '16px',
              }}
            >
              {labels.forRecipient}
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'absolute',
            bottom: '64px',
            left: '80px',
            right: '80px',
          }}
        >
          <img src={`data:image/png;base64,${logo.toString('base64')}`} alt="Documenso" width={204} height={30} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              borderRadius: '999px',
              backgroundColor: '#a2e771',
              color: '#0f172a',
              fontSize: '22px',
              fontWeight: 600,
            }}
          >
            {labels.cta}
            <span style={{ fontSize: '24px' }}>→</span>
          </div>
        </div>
      </div>,
      {
        width: IMAGE_SIZE.width,
        height: IMAGE_SIZE.height,
        fonts: [
          { name: 'Inter', data: interRegular, weight: 400 as const },
          { name: 'Inter', data: interSemiBold, weight: 600 as const },
          { name: 'Inter', data: interBold, weight: 700 as const },
          ...(cjkFont && cjkFontData ? [{ name: cjkFont.family, data: cjkFontData, weight: 400 as const }] : []),
        ],
      },
    );

    const pngBuffer = await svgToPng(svg.toString());

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pngBuffer.length.toString(),
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch {
    // Never let this surface an HTML error page — crawlers cache whatever this
    // URL returns and it is consumed as an <img> source.
    return genericImageResponse();
  }
};
