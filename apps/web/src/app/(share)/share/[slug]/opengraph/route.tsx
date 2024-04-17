<<<<<<< HEAD
import { ImageResponse, NextResponse } from 'next/server';

import { P, match } from 'ts-pattern';

import { getRecipientOrSenderByShareLinkSlug } from '@documenso/lib/server-only/share/get-recipient-or-sender-by-share-link-slug';

import { Logo } from '~/components/branding/logo';
import { getAssetBuffer } from '~/helpers/get-asset-buffer';

const CARD_OFFSET_TOP = 152;
const CARD_OFFSET_LEFT = 350;
const CARD_WIDTH = 500;
const CARD_HEIGHT = 250;

const size = {
=======
import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';

import { P, match } from 'ts-pattern';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import type { ShareHandlerAPIResponse } from '~/pages/api/share';

export const runtime = 'edge';

const CARD_OFFSET_TOP = 173;
const CARD_OFFSET_LEFT = 307;
const CARD_WIDTH = 590;
const CARD_HEIGHT = 337;

const IMAGE_SIZE = {
>>>>>>> main
  width: 1200,
  height: 630,
};

type SharePageOpenGraphImageProps = {
  params: { slug: string };
};

export async function GET(_request: Request, { params: { slug } }: SharePageOpenGraphImageProps) {
  const [interSemiBold, interRegular, caveatRegular, shareFrameImage] = await Promise.all([
<<<<<<< HEAD
    getAssetBuffer('/fonts/inter-semibold.ttf'),
    getAssetBuffer('/fonts/inter-regular.ttf'),
    getAssetBuffer('/fonts/caveat-regular.ttf'),
    getAssetBuffer('/static/og-share-frame.png'),
  ]);

  const recipientOrSender = await getRecipientOrSenderByShareLinkSlug({ slug }).catch(() => null);

  if (!recipientOrSender) {
=======
    fetch(new URL('@documenso/assets/fonts/inter-semibold.ttf', import.meta.url)).then(
      async (res) => res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/fonts/inter-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/fonts/caveat-regular.ttf', import.meta.url)).then(
      async (res) => res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/static/og-share-frame2.png', import.meta.url)).then(
      async (res) => res.arrayBuffer(),
    ),
  ]);

  const baseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const recipientOrSender: ShareHandlerAPIResponse = await fetch(
    new URL(`/api/share?slug=${slug}`, baseUrl),
  ).then(async (res) => res.json());

  if ('error' in recipientOrSender) {
>>>>>>> main
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isRecipient = 'Signature' in recipientOrSender;

  const signatureImage = match(recipientOrSender)
    .with({ Signature: P.array(P._) }, (recipient) => {
      return recipient.Signature?.[0]?.signatureImageAsBase64 || null;
    })
    .otherwise((sender) => {
      return sender.signature || null;
    });

  const signatureName = match(recipientOrSender)
    .with({ Signature: P.array(P._) }, (recipient) => {
      return recipient.name || recipient.email;
    })
    .otherwise((sender) => {
      return sender.name || sender.email;
    });

  return new ImageResponse(
    (
<<<<<<< HEAD
      <div tw="relative flex h-full w-full">
        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={shareFrameImage} alt="og-share-frame" tw="absolute inset-0 w-full h-full" />

        <div tw="absolute top-20 flex w-full items-center justify-center">
          {/* @ts-expect-error Lack of typing from ImageResponse */}
          <Logo tw="h-8 w-60" />
        </div>

=======
      <div tw="relative flex h-full w-full bg-white">
        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={shareFrameImage} alt="og-share-frame" tw="absolute inset-0 w-full h-full" />

>>>>>>> main
        {signatureImage ? (
          <div
            tw="absolute py-6 px-12 flex items-center justify-center text-center"
            style={{
              top: `${CARD_OFFSET_TOP}px`,
              left: `${CARD_OFFSET_LEFT}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
            }}
          >
            <img src={signatureImage} alt="signature" tw="opacity-60 h-full max-w-[100%]" />
          </div>
        ) : (
          <p
            tw="absolute py-6 px-12 -mt-2 flex items-center justify-center text-center text-slate-500"
            style={{
              fontFamily: 'Caveat',
              fontSize: `${Math.max(
                Math.min((CARD_WIDTH * 1.5) / signatureName.length, 80),
                36,
              )}px`,
              top: `${CARD_OFFSET_TOP}px`,
              left: `${CARD_OFFSET_LEFT}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
            }}
          >
            {signatureName}
          </p>
        )}

<<<<<<< HEAD
        {/* <div
          tw="absolute flex items-center justify-center text-slate-500"
          style={{
            top: `${CARD_OFFSET_TOP + CARD_HEIGHT - 45}px`,
            left: `${CARD_OFFSET_LEFT}`,
            width: `${CARD_WIDTH}px`,
            fontSize: '30px',
          }}
        >
          {signatureName}
        </div> */}

        <div
          tw="absolute flex flex-col items-center justify-center pt-12 w-full"
          style={{
            top: `${CARD_OFFSET_TOP + CARD_HEIGHT}px`,
          }}
        >
          <h2
            tw="text-3xl text-slate-500"
            style={{
              fontFamily: 'Inter',
              fontWeight: 600,
            }}
          >
            {isRecipient
              ? 'I just signed with Documenso and you can too!'
              : 'I just sent a document with Documenso and you can too!'}
=======
        <div
          tw="absolute flex w-full"
          style={{
            top: `${CARD_OFFSET_TOP - 78}px`,
            left: `${CARD_OFFSET_LEFT}px`,
          }}
        >
          <h2
            tw="text-xl"
            style={{
              color: '#828282',
              fontFamily: 'Inter',
              fontWeight: 700,
            }}
          >
            {isRecipient ? 'Document Signed!' : 'Document Sent!'}
>>>>>>> main
          </h2>
        </div>
      </div>
    ),
    {
<<<<<<< HEAD
      ...size,
=======
      ...IMAGE_SIZE,
>>>>>>> main
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
<<<<<<< HEAD
=======
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
>>>>>>> main
    },
  );
}
