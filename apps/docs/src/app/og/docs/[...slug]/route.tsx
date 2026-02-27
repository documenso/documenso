import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

import { getPageImage, source } from '@/lib/source';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const revalidate = false;

const loadAssets = async () => {
  const [logoBuffer, interRegularData, interSemiBoldData, interBoldData] = await Promise.all([
    readFile(fileURLToPath(new URL('../../../../../public/logo.png', import.meta.url))),
    readFile(
      fileURLToPath(new URL('../../../../../public/fonts/inter-regular.ttf', import.meta.url)),
    ),
    readFile(
      fileURLToPath(new URL('../../../../../public/fonts/inter-semibold.ttf', import.meta.url)),
    ),
    readFile(fileURLToPath(new URL('../../../../../public/fonts/inter-bold.ttf', import.meta.url))),
  ]);

  return {
    logoSrc: `data:image/png;base64,${logoBuffer.toString('base64')}`,
    fonts: [
      { name: 'Inter', data: interRegularData, weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: interSemiBoldData, weight: 600 as const, style: 'normal' as const },
      { name: 'Inter', data: interBoldData, weight: 700 as const, style: 'normal' as const },
    ],
  };
};

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));

  if (!page) {
    notFound();
  }

  const { logoSrc, fonts } = await loadAssets();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          padding: '60px 80px',
          fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* Green accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            backgroundColor: '#6DC947',
          }}
        />

        {/* Top: Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Documenso" height="28" />
          <span
            style={{
              color: '#D4D4D8',
              fontSize: '28px',
              fontWeight: 400,
            }}
          >
            |
          </span>
          <span style={{ color: '#71717A', fontSize: '20px', fontWeight: 400 }}>Docs</span>
        </div>

        {/* Middle: Title + description */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <h1
            style={{
              color: '#18181B',
              fontSize: page.data.title.length > 40 ? '48px' : '56px',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            {page.data.title}
          </h1>
          {page.data.description && (
            <p
              style={{
                color: '#71717A',
                fontSize: '22px',
                fontWeight: 400,
                lineHeight: 1.4,
                margin: 0,
                maxWidth: '900px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {page.data.description}
            </p>
          )}
        </div>

        {/* Bottom: URL */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#A1A1AA', fontSize: '16px', fontWeight: 400 }}>
            docs.documenso.com{page.url}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
