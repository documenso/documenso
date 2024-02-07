import { Caveat } from 'next/font/google';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { redis } from '@documenso/lib/server-only/redis';
import { stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';
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

export default async function ClaimedPlanPage({
  params: { locale },
  searchParams = {},
}: {
  params: { locale: string };
  searchParams: ClaimedPlanPageProps['searchParams'];
}) {
  const { sessionId } = searchParams;
  const { t } = await initTranslations(locale);

  if (typeof sessionId !== 'string') {
    redirect('/');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

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
        {t('welcome_to_the')} <span className="text-primary">{t('open_signing')}</span>{' '}
        {t('revolution')} <u>{user.name}</u>
      </h1>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
        {t('its_not_every_day')}
      </p>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
        {t('but_today_is_that_day_by_signing_documenso')}
      </p>

      <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
        {t('we_are_going_to_change_the_way_people_sign_documents')}
      </p>

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">{t('lets_do_it_together')}</h2>

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
              Co Founder
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
              Co Founder
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
              {t('our_new_favourite_customer')}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-foreground text-2xl font-bold">{t('your_sign_in_details')}</h2>

        <div className="mt-4">
          <p className="text-muted-foreground text-lg">
            <span className="font-bold">{t('email')}:</span> {user.email}
          </p>

          <p className="text-muted-foreground mt-2 text-lg">
            <span className="font-bold">{t('password')}</span>{' '}
            <PasswordReveal password={password ?? 'password'} />
          </p>
        </div>

        <p className="text-muted-foreground mt-4 text-sm italic">
          {t('this_is_a_temporary_password')}
        </p>

        <Link
          href={`${process.env.NEXT_PUBLIC_WEBAPP_URL}/signin`}
          target="_blank"
          className="mt-4 block"
        >
          <Button size="lg" className="text-base">
            {t('lets_get_started')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
