import Stripe from 'stripe';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { alphaid, nanoid } from '@documenso/lib/universal/id';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  FieldType,
  ReadStatus,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';

import { ZEarlyAdopterCheckoutMetadataSchema } from './early-adopter-checkout-metadata';

export type OnEarlyAdoptersCheckoutOptions = {
  session: Stripe.Checkout.Session;
};

export const onEarlyAdoptersCheckout = async ({ session }: OnEarlyAdoptersCheckoutOptions) => {
  try {
    const safeMetadata = ZEarlyAdopterCheckoutMetadataSchema.safeParse(session.metadata);

    if (!safeMetadata.success) {
      return;
    }

    const { email, name, signatureText, signatureDataUrl: signatureDataUrlRef } = safeMetadata.data;

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (user) {
      return;
    }

    const tempPassword = nanoid(12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashSync(tempPassword),
        signature: signatureDataUrlRef,
      },
    });

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (customerId) {
      await stripe.customers.update(customerId, {
        metadata: {
          userId: newUser.id,
        },
      });
    }

    await redis.set(`user:${newUser.id}:temp-password`, tempPassword, {
      // expire in 1 week
      ex: 60 * 60 * 24 * 7,
    });

    const signatureDataUrl = await redis.get<string>(`signature:${session.client_reference_id}`);

    const documentBuffer = await fetch(
      `${process.env.NEXT_PUBLIC_WEBAPP_URL}/documenso-supporter-pledge.pdf`,
    ).then(async (res) => res.arrayBuffer());

    const { id: documentDataId } = await putFile({
      name: 'Documenso Supporter Pledge.pdf',
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(documentBuffer),
    });

    const document = await prisma.document.create({
      data: {
        title: 'Documenso Supporter Pledge.pdf',
        status: DocumentStatus.COMPLETED,
        userId: newUser.id,
        documentDataId,
      },
    });

    const recipient = await prisma.recipient.create({
      data: {
        name,
        email: email.toLowerCase(),
        token: alphaid(),
        readStatus: ReadStatus.OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.SIGNED,
        signedAt: new Date(),
        documentId: document.id,
      },
    });

    await prisma.field.create({
      data: {
        type: FieldType.SIGNATURE,
        recipientId: recipient.id,
        documentId: document.id,
        page: 1,
        positionX: 12.2781,
        positionY: 81.5789,
        height: 6.8649,
        width: 29.5857,
        inserted: true,
        customText: '',

        Signature: {
          create: {
            typedSignature: signatureDataUrl ? null : signatureText || name,
            signatureImageAsBase64: signatureDataUrl,
            recipientId: recipient.id,
          },
        },
      },
    });

    await sealDocument({
      documentId: document.id,
      sendEmail: false,
    });
  } catch (error) {
    // We don't want to break the checkout process if something goes wrong here.
    // This is an additive experience for early adopters, breaking their ability
    // join would be far worse than not having a signed pledge.
    console.error('early-supporter-error', error);
  }
};
