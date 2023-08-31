import { ImageResponse, NextRequest } from 'next/server';

import { cn } from '@documenso/ui/lib/utils';

export const config = {
  runtime: 'edge',
};

const CARD_OFFSET_TOP = 152;
const CARD_OFFSET_LEFT = 350;
const CARD_WIDTH = 500;
const CARD_HEIGHT = 250;

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const signature = searchParams.get('signature') || 'Timur';

  const [interSemiBold, interRegular, caveatRegular, shareFrameImage] = await Promise.all([
    fetch(new URL('./../../../assets/inter-semibold.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../assets/inter-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../assets/caveat-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../assets/og-share-frame.png', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div tw="relative flex h-full w-full">
        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={shareFrameImage} alt="og-share-frame" tw="absolute inset-0 w-full h-full" />

        <p
          tw="absolute py-6 px-12 -mt-2 flex items-center justify-center text-center"
          style={{
            fontFamily: 'Caveat',
            fontSize: `${Math.max(Math.min((CARD_WIDTH * 1.5) / signature.length, 80), 36)}px`,
            top: `${CARD_OFFSET_TOP}px`,
            left: `${CARD_OFFSET_LEFT}px`,
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
          }}
        >
          {signature}
        </p>

        <div
          tw="absolute absolute flex flex-col items-center justify-center pt-2.5 w-full"
          style={{
            top: `${CARD_OFFSET_TOP + CARD_HEIGHT}px`,
          }}
        >
          <h2
            tw="text-2xl text-slate-900/60"
            style={{
              fontFamily: 'Inter',
              fontWeight: 600,
            }}
          >
            I just signed with Documenso
          </h2>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Caveat',
          data: caveatRegular,
          style: 'italic',
        },
        {
          name: 'Inter',
          data: interRegular,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: interSemiBold,
          style: 'normal',
          weight: 600,
        },
      ],
    },
  );
}
