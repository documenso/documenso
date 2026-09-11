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

/**
 * Budgets are in display units rather than characters: full-width scripts take
 * roughly twice the advance of Latin at the same size, so counting characters
 * alone would either clip Chinese or truncate English long before it needs to
 * be. Each budget is sized to keep its text within two rendered lines — the
 * sender's is the tightest because it shares the headline with a sentence of
 * surrounding copy, and a third headline line pushes the footer off the card.
 */
const TITLE_WIDTH_BUDGET = 110;
const SENDER_WIDTH_BUDGET = 34;
const RECIPIENT_WIDTH_BUDGET = 70;

/** CJK, kana, Hangul and full-width forms all render at ~2x Latin advance. */
const FULL_WIDTH_PATTERN =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

const displayWidth = (value: string) =>
  [...value].reduce((total, char) => total + (FULL_WIDTH_PATTERN.test(char) ? 2 : 1), 0);

const truncate = (value: string, budget: number) => {
  if (displayWidth(value) <= budget) {
    return value;
  }

  let width = 0;
  let cut = '';

  for (const char of value) {
    const next = width + (FULL_WIDTH_PATTERN.test(char) ? 2 : 1);

    // Leave room for the ellipsis.
    if (next > budget - 1) {
      break;
    }

    width = next;
    cut += char;
  }

  const lastSpace = cut.lastIndexOf(' ');

  // Break on a word boundary when one is close to the limit, otherwise cut
  // hard — scripts without spaces have no boundary to find.
  if (lastSpace > 0 && displayWidth(cut.slice(0, lastSpace)) > budget * 0.7) {
    cut = cut.slice(0, lastSpace);
  }

  return `${cut.trimEnd()}…`;
};

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
 * satori's opentype parser cannot read (it throws on the `fvar` table). Those
 * languages fall back to an English card until static builds of those faces are
 * added to `public/fonts`.
 */
const CJK_FONTS: Record<string, { family: string; file: string } | null> = {
  zh: { family: 'Noto Sans Chinese', file: 'fonts/noto-sans-chinese.ttf' },
  ja: null,
  ko: null,
};

const isCjkLanguage = (language: string) => language in CJK_FONTS;

type CardContent = {
  badge: string | null;
  headline: string;
  subheadline: string | null;
  detail: {
    label: string;
    title: string;
    recipient: string | null;
  } | null;
  cta: string | null;
};

const renderCard = async (content: CardContent, cjkFamily: string | null, cjkFontData: Buffer | null) => {
  const [interRegular, interSemiBold, interBold, logo] = await Promise.all([
    loadAsset('fonts/inter-regular.ttf'),
    loadAsset('fonts/inter-semibold.ttf'),
    loadAsset('fonts/inter-bold.ttf'),
    loadAsset('static/logo.png'),
  ]);

  const svg = await satori(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '72px 80px',
        fontFamily: cjkFamily ? `Inter, ${cjkFamily}` : 'Inter',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          // The content area absorbs the free space so the footer sits at the
          // bottom, and clips its own overflow so unusually long copy can never
          // push the footer into (or past) the bottom padding.
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
          overflow: 'hidden',
          // Without the detail card there is a lot of slack; centring it keeps
          // the neutral card from reading as a half-empty page.
          justifyContent: content.detail ? 'flex-start' : 'center',
        }}
      >
        {content.badge ? (
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
              {content.badge}
            </span>
          </div>
        ) : null}

        <p
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            color: '#0f172a',
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.15,
            margin: 0,
            marginTop: content.badge ? '32px' : '0',
          }}
        >
          {content.headline}
        </p>

        {content.detail ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '32px',
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
              {content.detail.label}
            </span>
            <span
              style={{
                color: '#0f172a',
                fontSize: '30px',
                fontWeight: 600,
                marginTop: '8px',
                lineHeight: 1.2,
              }}
            >
              {content.detail.title}
            </span>
            {content.detail.recipient ? (
              <span
                style={{
                  color: '#475569',
                  fontSize: '22px',
                  marginTop: '16px',
                }}
              >
                {content.detail.recipient}
              </span>
            ) : null}
          </div>
        ) : null}

        {content.subheadline ? (
          <span
            style={{
              color: '#64748b',
              fontSize: '26px',
              marginTop: '20px',
            }}
          >
            {content.subheadline}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '32px',
          // Never give up its row to the content above.
          flexShrink: 0,
        }}
      >
        <img src={`data:image/png;base64,${logo.toString('base64')}`} alt="Documenso" width={204} height={30} />
        {content.cta ? (
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
            {content.cta}
            <span style={{ fontSize: '24px' }}>→</span>
          </div>
        ) : null}
      </div>
    </div>,
    {
      width: IMAGE_SIZE.width,
      height: IMAGE_SIZE.height,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400 as const },
        { name: 'Inter', data: interSemiBold, weight: 600 as const },
        { name: 'Inter', data: interBold, weight: 700 as const },
        ...(cjkFamily && cjkFontData ? [{ name: cjkFamily, data: cjkFontData, weight: 400 as const }] : []),
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
};

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { token } = params;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  /**
   * A branded 1200x630 card carrying no document details, for links we can't
   * or shouldn't describe. Still a real OpenGraph image rather than the
   * site-wide marketing asset, which is neither the right aspect ratio nor
   * meaningful on a signing link.
   */
  const renderNeutralCard = async (variant: 'signing-request' | 'plain') => {
    const i18n = await getI18nInstance('en');

    return renderCard(
      {
        badge: variant === 'signing-request' ? i18n._(msg`Signature requested`) : null,
        headline:
          variant === 'signing-request'
            ? i18n._(msg`You have a document to sign`)
            : i18n._(msg`Sign documents with Documenso`),
        subheadline:
          variant === 'signing-request'
            ? i18n._(msg`Open the link to review and sign it.`)
            : i18n._(msg`The open source signing platform.`),
        detail: null,
        cta: variant === 'signing-request' ? i18n._(msg`Sign document`) : null,
      },
      null,
      null,
    );
  };

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

    // Mirrors the redirects in the signing page loader — these states render
    // their own pages, none of which is a signature request.
    const isActionableSigningRequest =
      document.status === DocumentStatus.PENDING &&
      recipient.signingStatus === SigningStatus.NOT_SIGNED &&
      !isRecipientExpired(recipient);

    if (!isActionableSigningRequest) {
      return renderNeutralCard('plain');
    }

    // The signing page hides everything behind an auth gate when access auth is
    // required. The crawler has no session, so it must not see more than that.
    const { recipientAccessAuthRequired } = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    if (recipientAccessAuthRequired) {
      return renderNeutralCard('signing-request');
    }

    const language = document.documentMeta?.language ?? 'en';
    const cjkFont = CJK_FONTS[language] ?? null;

    // A language we have no usable face for would render as blank boxes.
    if (isCjkLanguage(language) && !cjkFont) {
      return renderNeutralCard('signing-request');
    }

    const [cjkFontData, i18n] = await Promise.all([
      cjkFont ? loadAsset(cjkFont.file) : Promise.resolve(null),
      getI18nInstance(language),
    ]);

    const sender = truncate(document.user.name || document.user.email, SENDER_WIDTH_BUDGET);
    const recipientName = recipient.name || recipient.email;

    return await renderCard(
      {
        badge: i18n._(msg`Signature requested`),
        headline: i18n._(msg`${sender} has sent you a document to sign`),
        subheadline: null,
        detail: {
          label: i18n._(msg`Document`),
          title: truncate(document.title, TITLE_WIDTH_BUDGET),
          recipient: recipientName ? i18n._(msg`For ${truncate(recipientName, RECIPIENT_WIDTH_BUDGET)}`) : null,
        },
        cta: i18n._(msg`Sign document`),
      },
      cjkFont?.family ?? null,
      cjkFontData,
    );
  } catch {
    // Never let this surface an HTML error page — crawlers cache whatever this
    // URL returns and it is consumed as an <img> source.
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
};
