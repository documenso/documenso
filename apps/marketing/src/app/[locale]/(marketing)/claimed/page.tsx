import { Caveat } from 'next/font/google';
import Link from 'next/link';
import { redirect, useParams } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { useTranslation } from '@documenso/ui/i18n/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { PasswordReveal } from '~/components/(marketing)/password-reveal';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
});

export type ClaimedPlanPageProps = {
  searchParams?: {
    sessionId?: string;
  };
};

export default async function ClaimedPlanPage({ searchParams = {} }: ClaimedPlanPageProps) {
  const { sessionId } = searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locale = useParams()?.locale as any;

  if (typeof sessionId !== 'string') {
    redirect('/');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const { t } = useTranslation(locale, 'marketing');

  if (!customerId) {
    redirect('/');
  }

  const customer = await stripe.customers.retrieve(customerId);

  if (!customer || customer.deleted) {
    redirect('/');
  }

  const user = await prisma.user.findFirst({
    where: {
      id: Number(customer.metadata.userId),
    },
  });

  if (!user) {
    redirect('/');
  }

  const signatureText = session.metadata?.signatureText || user.name;
  let signatureDataUrl = '';

  if (session.metadata?.signatureDataUrl) {
    const result = await redis.get<string>(`signature:${session.metadata.signatureDataUrl}`);

    if (result) {
      signatureDataUrl = result;
    }
  }

  const password = await redis.get<string>(`user:${user.id}:temp-password`);

  return (
    <div className="mt-12">
      <h1 className="text-foreground text-3xl font-bold md:text-4xl">
        {t(`welcome`)}
        <span className="text-primary">{t(`open-signing`)}</span>
        {t(`revolution`)} <u>{user.name}</u>
      </h1>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">{t(`its-not`)}</p>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
        {t(`but-today`)}
      </p>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
        {t(`change-the-way`)}
      </p>

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">Let's do it together</h2>

        <div className="-mx-4 mt-8 flex md:-mx-8">
          <div className="flex flex-1 flex-col justify-end gap-y-4 border-r px-4 last:border-r-0 md:px-8 lg:flex-none">
            <p
              className={cn(
                'text-foreground text-4xl font-semibold md:text-5xl',
                fontCaveat.className,
              )}
            >
              Timur
            </p>

            <p className="text-muted-foreground text-sm md:text-lg">
              Timur Ercan
              <span className="block lg:hidden" />
              <span className="hidden lg:inline"> - </span>
              {t(`co-founder`)}
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-y-4 border-r px-4 last:border-r-0 md:px-8 lg:flex-none">
            <p
              className={cn(
                'text-foreground text-4xl font-semibold md:text-5xl',
                fontCaveat.className,
              )}
            >
              Lucas
            </p>

            <p className="text-muted-foreground text-sm md:text-lg">
              Lucas Smith
              <span className="block lg:hidden" />
              <span className="hidden lg:inline"> - </span>
              {t(`co-founder`)}
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-y-4 border-r px-4 last:border-r-0 md:px-8 lg:flex-none">
            {signatureDataUrl && (
              <img
                src={signatureDataUrl}
                alt="your-signature"
                className="max-w-[172px] dark:invert"
              />
            )}
            {!signatureDataUrl && (
              <p
                className={cn(
                  'text-foreground text-4xl font-semibold md:text-5xl',
                  fontCaveat.className,
                )}
              >
                {signatureText}
              </p>
            )}

            <p className="text-muted-foreground text-sm md:text-lg">
              {user.name}
              <span className="block lg:hidden" />
              <span className="hidden lg:inline"> - </span>
              {t(`our-new-favorite`)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">{t(`your-sign-in-details`)}</h2>

        <div className="mt-4">
          <p className="text-muted-foreground text-lg">
            <span className="font-bold">{t(`email`)}</span> {user.email}
          </p>

          <p className="text-muted-foreground mt-2 text-lg">
            <span className="font-bold">{t(`password`)}:</span>{' '}
            <PasswordReveal password={password ?? 'password'} locale={locale} />
          </p>
        </div>

        <p className="text-muted-foreground mt-4 text-sm italic">{t(`temp-pass`)}</p>

        <Link
          href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signin`}
          target="_blank"
          className="mt-4 block"
        >
          <Button size="lg" className="text-base">
            {t(`lets-get-started`)}

            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
