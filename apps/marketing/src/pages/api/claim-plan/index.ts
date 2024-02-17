import type { NextApiRequest, NextApiResponse } from 'next';

import { randomUUID } from 'crypto';

import type { TEarlyAdopterCheckoutMetadataSchema } from '@documenso/ee/server-only/stripe/webhook/early-adopter-checkout-metadata';
import { NEXT_PUBLIC_MARKETING_URL, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

import type { TClaimPlanResponseSchema } from '~/api/claim-plan/types';
import { ZClaimPlanRequestSchema } from '~/api/claim-plan/types';

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
    });

    if (user) {
      return res.status(200).json({
        redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/signin`,
      });
    }

    const clientReferenceId = randomUUID();

    if (signatureDataUrl) {
      await redis.set(`signature:${clientReferenceId}`, signatureDataUrl, {
        // expire in 7 days
        ex: 60 * 60 * 24 * 7,
      });
    }

    const metadata: TEarlyAdopterCheckoutMetadataSchema = {
      name,
      email,
      signatureText: signatureText || name,
      source: 'marketing',
    };

    if (signatureDataUrl) {
      metadata.signatureDataUrl = clientReferenceId;
    }

    const checkout = await stripe.checkout.sessions.create({
      customer_email: email,
      // Using the UUID here means our webhook will not try to use it as a user ID.
      client_reference_id: clientReferenceId,
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata,
      allow_promotion_codes: true,
      success_url: `${NEXT_PUBLIC_MARKETING_URL()}/claimed?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${NEXT_PUBLIC_MARKETING_URL()}`,
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
