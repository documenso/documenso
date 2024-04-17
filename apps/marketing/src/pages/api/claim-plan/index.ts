import { NextApiRequest, NextApiResponse } from 'next';

import { randomUUID } from 'crypto';

import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

import { TClaimPlanResponseSchema, ZClaimPlanRequestSchema } from '~/api/claim-plan/types';

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
        // expire in 7 days
        ex: 60 * 60 * 24 * 7,
      });
    }

    const metadata: Record<string, string> = {
      name,
      email,
      signatureText: signatureText || name,
      source: 'landing',
    };

    if (signatureDataUrl) {
      metadata.signatureDataUrl = signatureDataUrlKey;
    }

    const checkout = await stripe.checkout.sessions.create({
      customer_email: email,
      client_reference_id: userId.toString(),
      payment_method_types: ['card'],
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata,
      allow_promotion_codes: true,
      success_url: `${process.env.NEXT_PUBLIC_MARKETING_URL}/claimed?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_MARKETING_URL}/pricing?email=${encodeURIComponent(
        email,
      )}&name=${encodeURIComponent(name)}&planId=${planId}&cancelled=true`,
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
