import { randomUUID } from 'crypto';
import { infer as ZodInfer, z } from 'zod';

import { InferApiRoute, api, returnResponse } from '@documenso/lib/server-only/api/create-API';
import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';

const ClaimPlanRequestSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => value.toLowerCase()),
    name: z.string(),
    planId: z.string(),
  })
  .and(
    z.union([
      z.object({
        signatureDataUrl: z.string().min(1),
        signatureText: z.null(),
      }),
      z.object({
        signatureDataUrl: z.null(),
        signatureText: z.string().min(1),
      }),
    ]),
  );

export const POST = async (req_: Request) =>
  api
    .create(req_)
    .input({
      body: ClaimPlanRequestSchema,
    })
    .procedure(async ({ res, input, context: ctx }) => {
      const { email, name, planId, signatureDataUrl, signatureText } = input.body;

      const user = await ctx.db.user.findFirst({
        where: {
          email: email.toLowerCase(),
        },
        include: {
          Subscription: true,
        },
      });
      if (user && user.Subscription.length > 0) {
        return res.json(
          returnResponse({
            success: true,
            data: { redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login` },
            message: null,
          }),
          { status: 200 },
        );
      }
      const password = Math.random().toString(36).slice(2, 9);
      const passwordHash = hashSync(password);

      const { id: userId } = await ctx.db.user.upsert({
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
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/claimed?sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?email=${encodeURIComponent(
          email,
        )}&name=${encodeURIComponent(name)}&planId=${planId}&cancelled=true`,
      });

      if (!checkout.url) {
        return res.json(
          returnResponse({
            success: false,
            message: 'Checkout URL not found',
            data: null,
          }),
          { status: 500 },
        );
      }

      return res.json(
        returnResponse({
          success: true,
          data: { redirectUrl: checkout.url },
          message: null,
        }),
        { status: 200 },
      );
    });

export type ClaimPlanPostResponse = InferApiRoute<typeof POST>;
export type TClaimPlanRequestSchema = ZodInfer<typeof ClaimPlanRequestSchema>;
