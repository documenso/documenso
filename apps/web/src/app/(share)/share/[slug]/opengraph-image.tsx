import { ImageResponse } from 'next/server';

import { P, match } from 'ts-pattern';

import { getRecipientOrSenderByShareLinkSlug } from '@documenso/lib/server-only/share/get-recipient-or-sender-by-share-link-slug';

export const runtime = 'edge';

const CARD_OFFSET_TOP = 152;
const CARD_OFFSET_LEFT = 350;
const CARD_WIDTH = 500;
const CARD_HEIGHT = 250;

const size = {
  width: 1200,
  height: 630,
};

type SharePageOpenGraphImageProps = {
  params: { slug: string };
};

export default async function Image({ params: { slug } }: SharePageOpenGraphImageProps) {
  const recipientOrSender = await getRecipientOrSenderByShareLinkSlug({ slug }).catch(() => null);

  if (!recipientOrSender) {
    return null;
  }

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

  const [interSemiBold, interRegular, caveatRegular, shareFrameImage] = await Promise.all([
    fetch(new URL('./../../../../assets/inter-semibold.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../assets/inter-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../assets/caveat-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../assets/og-share-frame.png', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div tw="relative flex h-full w-full">
        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={shareFrameImage} alt="og-share-frame" tw="absolute inset-0 w-full h-full" />

        {signatureImage ? (
          <div
            tw="absolute py-6 px-12 -mt-2 flex items-center justify-center text-center"
            style={{
              top: `${CARD_OFFSET_TOP}px`,
              left: `${CARD_OFFSET_LEFT}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
            }}
          >
            <img src={signatureImage} alt="signature" tw="w-full h-full" />
          </div>
        ) : (
          <p
            tw="absolute py-6 px-12 -mt-2 flex items-center justify-center text-center"
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
      ...size,
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
