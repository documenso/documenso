import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    // This is optional because it's only used in development.
    // See https://next-auth.js.org/deployment.
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    SENDGRID_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    SMTP_MAIL_HOST: z.string().min(1),
    SMTP_MAIL_PORT: z.string().min(1),
    SMTP_MAIL_USER: z.string().min(1),
    SMTP_MAIL_PASSWORD: z.string().min(1),
    MAIL_FROM: z.string().min(1),
    STRIPE_API_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1),
    NEXT_PUBLIC_WEBAPP_URL: z.string().min(1),
    NEXT_PUBLIC_ALLOW_SIGNUP: z.string().min(1),
    NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS: z.string().min(1),
    NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID: z.string().optional(),
    NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID: z.string().optional(),
  },
  /**
   * What object holds the environment variables at runtime.
   * Often `process.env` or `import.meta.env`
   */
  runtimeEnv: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_MAIL_HOST: process.env.SMTP_MAIL_HOST,
    SMTP_MAIL_PORT: process.env.SMTP_MAIL_PORT,
    SMTP_MAIL_USER: process.env.SMTP_MAIL_USER,
    SMTP_MAIL_PASSWORD: process.env.SMTP_MAIL_PASSWORD,
    MAIL_FROM: process.env.MAIL_FROM,
    STRIPE_API_KEY: process.env.STRIPE_API_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WEBAPP_URL: process.env.NEXT_PUBLIC_WEBAPP_URL,
    NEXT_PUBLIC_ALLOW_SIGNUP: process.env.NEXT_PUBLIC_ALLOW_SIGNUP,
    NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS: process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS,
    NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID:
      process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID,
    NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID:
      process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID,
  },
});
