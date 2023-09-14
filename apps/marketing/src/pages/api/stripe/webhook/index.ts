import { NextApiRequest, NextApiResponse } from 'next';

import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { buffer } from 'micro';

import { insertImageInPDF } from '@documenso/lib/server-only/pdf/insert-image-in-pdf';
import { insertTextInPDF } from '@documenso/lib/server-only/pdf/insert-text-in-pdf';
import { redis } from '@documenso/lib/server-only/redis';
import { Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import { updateFile } from '@documenso/lib/universal/upload/update-file';
import { prisma } from '@documenso/prisma';
import {
  DocumentDataType,
  DocumentStatus,
  FieldType,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';

const log = (...args: unknown[]) => console.log('[stripe]', ...args);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // if (!process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS) {
  //   return res.status(500).json({
  //     success: false,
  //     message: 'Subscriptions are not enabled',
  //   });
  // }

  const sig =
    typeof req.headers['stripe-signature'] === 'string' ? req.headers['stripe-signature'] : '';

  if (!sig) {
    return res.status(400).json({
      success: false,
      message: 'No signature found in request',
    });
  }

  log('constructing body...');
  const body = await buffer(req);
  log('constructed body');

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, turbo/no-undeclared-env-vars
    process.env.NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET!,
  );
  log('event-type:', event.type);

  if (event.type === 'checkout.session.completed') {
    // This typecast is required since we don't want to create a guard for every event type
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.source === 'landing') {
      const user = await prisma.user.findFirst({
        where: {
          id: Number(session.client_reference_id),
        },
      });

      if (!user) {
        return res.status(500).json({
          success: false,
          message: 'User not found',
        });
      }

      const signatureText = session.metadata?.signatureText || user.name;
      let signatureDataUrl = '';

      if (session.metadata?.signatureDataUrl) {
        const result = await redis.get<string>(`signature:${session.metadata.signatureDataUrl}`);

        if (result) {
          signatureDataUrl = result;
        }
      }

      const now = new Date();

      const bytes64 = readFileSync('./public/documenso-supporter-pledge.pdf').toString('base64');

      const { id: documentDataId } = await prisma.documentData.create({
        data: {
          type: DocumentDataType.BYTES_64,
          data: bytes64,
          initialData: bytes64,
        },
      });

      const document = await prisma.document.create({
        data: {
          title: 'Documenso Supporter Pledge.pdf',
          status: DocumentStatus.COMPLETED,
          userId: user.id,
          documentDataId,
        },
        include: {
          documentData: true,
        },
      });

      const { documentData } = document;

      if (!documentData) {
        throw new Error(`Document ${document.id} has no document data`);
      }

      const recipient = await prisma.recipient.create({
        data: {
          name: user.name ?? '',
          email: user.email,
          token: randomBytes(16).toString('hex'),
          signedAt: now,
          readStatus: ReadStatus.OPENED,
          sendStatus: SendStatus.SENT,
          signingStatus: SigningStatus.SIGNED,
          documentId: document.id,
        },
      });

      const field = await prisma.field.create({
        data: {
          documentId: document.id,
          recipientId: recipient.id,
          type: FieldType.SIGNATURE,
          page: 0,
          positionX: 77,
          positionY: 638,
          inserted: false,
          customText: '',
        },
      });

      let pdfData = await getFile(documentData).then((data) =>
        Buffer.from(data).toString('base64'),
      );

      if (signatureDataUrl) {
        pdfData = await insertImageInPDF(
          pdfData,
          signatureDataUrl,
          Number(field.positionX),
          Number(field.positionY),
          field.page,
        );
      } else {
        pdfData = await insertTextInPDF(
          pdfData,
          signatureText ?? '',
          Number(field.positionX),
          Number(field.positionY),
          field.page,
        );
      }

      const { data: newData } = await updateFile({
        type: documentData.type,
        oldData: documentData.initialData,
        newData: Buffer.from(pdfData, 'base64').toString('binary'),
      });

      await Promise.all([
        prisma.signature.create({
          data: {
            fieldId: field.id,
            recipientId: recipient.id,
            signatureImageAsBase64: signatureDataUrl || undefined,
            typedSignature: signatureDataUrl ? '' : signatureText,
          },
        }),
        prisma.documentData.update({
          where: {
            id: documentData.id,
          },
          data: {
            data: newData,
          },
        }),
      ]);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  }

  log('Unhandled webhook event', event.type);

  return res.status(400).json({
    success: false,
    message: 'Unhandled webhook event',
  });
}
