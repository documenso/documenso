import { msg } from '@lingui/core/macro';
import satori from 'satori';

import { getI18nInstance } from '@documenso/lib/client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getDocumentAndSenderByToken } from '@documenso/lib/server-only/document/get-document-by-token';
import { svgToPng } from '@documenso/lib/utils/images/svg-to-png';

import type { Route } from './+types/opengraph';

const IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { token } = params;

  if (!token) {
    return new Response('Not found', { status: 404 });
  }

  const baseUrl = NEXT_PUBLIC_WEBAPP_URL();

  const document = await getDocumentAndSenderByToken({
    token,
    requireAccessAuth: false,
  }).catch(() => null);

  if (!document) {
    return new Response('Not found', { status: 404 });
  }

  const fetchFont = async (path: string) =>
    fetch(new URL(`${baseUrl}${path}`, import.meta.url)).then(async (res) => res.arrayBuffer());

  const cjkFontPath = ((): string | null => {
    const lang = document.documentMeta?.language ?? 'en';
    if (lang === 'ja') return '/fonts/noto-sans-japanese.ttf';
    if (lang === 'ko') return '/fonts/noto-sans-korean.ttf';
    if (lang === 'zh') return '/fonts/noto-sans-chinese.ttf';
    return null;
  })();

  const [interSemiBold, interRegular, interBold, cjkFont] = await Promise.all([
    fetchFont('/fonts/inter-semibold.ttf'),
    fetchFont('/fonts/inter-regular.ttf'),
    fetchFont('/fonts/inter-bold.ttf'),
    cjkFontPath ? fetchFont(cjkFontPath) : Promise.resolve(null),
  ]);

  const sender = document.user.name || document.user.email;
  const recipient = document.recipients[0];
  const recipientName = recipient?.name || recipient?.email || null;
  const documentTitle = truncate(document.title, 80);

  const language = document.documentMeta?.language ?? 'en';
  const i18n = await getI18nInstance(language);

  const labels = {
    badge: i18n._(msg`Signature requested`),
    headline: i18n._(msg`${sender} has sent you a document to sign`),
    documentLabel: i18n._(msg`Document`),
    forRecipient: recipientName ? i18n._(msg`For ${recipientName}`) : null,
    cta: i18n._(msg`Sign document`),
  };

  const svg = await satori(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '72px 80px',
        fontFamily: 'Inter',
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
        <img src={`${baseUrl}/static/logo.png`} alt="Documenso" width={204} height={30} />
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
        { name: 'Inter', data: interRegular, weight: 400 },
        { name: 'Inter', data: interSemiBold, weight: 600 },
        { name: 'Inter', data: interBold, weight: 700 },
        ...(cjkFont ? [{ name: 'Inter', data: cjkFont, weight: 400 as const }] : []),
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
