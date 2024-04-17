<<<<<<< HEAD
import { NextApiRequest, NextApiResponse } from 'next';

import { randomUUID } from 'crypto';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
=======
import type { NextApiRequest, NextApiResponse } from 'next';

import { randomUUID } from 'crypto';

import type { TEarlyAdopterCheckoutMetadataSchema } from '@documenso/ee/server-only/stripe/webhook/early-adopter-checkout-metadata';
import { NEXT_PUBLIC_MARKETING_URL, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
>>>>>>> main
import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

<<<<<<< HEAD
import { TClaimPlanResponseSchema, ZClaimPlanRequestSchema } from '~/api/claim-plan/types';
=======
import type { TClaimPlanResponseSchema } from '~/api/claim-plan/types';
import { ZClaimPlanRequestSchema } from '~/api/claim-plan/types';
>>>>>>> main

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TClaimPlanResponseSchema>,
) {
  try {
    const { method } = req;

    if (method?.toUpperCase() !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
      });
    }

    const safeBody = ZClaimPlanRequestSchema.safeParse(req.body);

    if (!safeBody.success) {
      return res.status(400).json({
        error: 'Bad request',
      });
    }

    const { email, name, planId, signatureDataUrl, signatureText } = safeBody.data;

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
      },
<<<<<<< HEAD
      include: {
        Subscription: true,
      },
    });

    if (user && user.Subscription) {
      return res.status(200).json({
        redirectUrl: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/login`,
      });
    }

    const password = Math.random().toString(36).slice(2, 9);
    const passwordHash = hashSync(password);

    const { id: userId } = await prisma.user.upsert({
      where: {
        email: email.toLowerCase(),
      },
      create: {
        email: email.toLowerCase(),
        name,
        password: passwordHash,
      },
      update: {
        name,
        password: passwordHash,
      },
    });

    await redis.set(`user:${userId}:temp-password`, password, {
      // expire in 24 hours
      ex: 60 * 60 * 24,
    });

    const signatureDataUrlKey = randomUUID();

    if (signatureDataUrl) {
      await redis.set(`signature:${signatureDataUrlKey}`, signatureDataUrl, {
=======
    });

    if (user) {
      return res.status(200).json({
        redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/signin`,
      });
    }

    const clientReferenceId = randomUUID();

    if (signatureDataUrl) {
      await redis.set(`signature:${clientReferenceId}`, signatureDataUrl, {
>>>>>>> main
        // expire in 7 days
        ex: 60 * 60 * 24 * 7,
      });
    }

<<<<<<< HEAD
    const metadata: Record<string, string> = {
      name,
      email,
      signatureText: signatureText || name,
      source: 'landing',
    };

    if (signatureDataUrl) {
      metadata.signatureDataUrl = signatureDataUrlKey;
=======
    const metadata: TEarlyAdopterCheckoutMetadataSchema = {
      name,
      email,
      signatureText: signatureText || name,
      source: 'marketing',
    };

    if (signatureDataUrl) {
      metadata.signatureDataUrl = clientReferenceId;
>>>>>>> main
    }

    const checkout = await stripe.checkout.sessions.create({
      customer_email: email,
<<<<<<< HEAD
      client_reference_id: userId.toString(),
      payment_method_types: ['card'],
=======
      // Using the UUID here means our webhook will not try to use it as a user ID.
      client_reference_id: clientReferenceId,
>>>>>>> main
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata,
      allow_promotion_codes: true,
<<<<<<< HEAD
      success_url: `${process.env.NEXT_PUBLIC_MARKETING_URL}/claimed?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_MARKETING_URL}/pricing?email=${encodeURIComponent(
        email,
      )}&name=${encodeURIComponent(name)}&planId=${planId}&cancelled=true`,
=======
      success_url: `${NEXT_PUBLIC_MARKETING_URL()}/claimed?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${NEXT_PUBLIC_MARKETING_URL()}`,
>>>>>>> main
    });

    if (!checkout.url) {
      throw new Error('Checkout URL not found');
    }

    return res.json({
      redirectUrl: checkout.url,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
