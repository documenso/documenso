import Link from 'next/link';

import { AlertTriangle, CheckCircle2, XCircle, XOctagon } from 'lucide-react';

import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';

export type PageProps = {
  params: {
    locale: string;
    token: string;
  };
};

export default async function VerifyEmailPage({ params: { locale, token } }: PageProps) {
  const { t } = await initTranslations(locale);
  if (!token) {
    return (
      <div className="w-full">
        <div className="mb-4 text-red-300">
          <XOctagon />
        </div>

        <h2 className="text-4xl font-semibold">{t('no_token_provided')}</h2>
        <p className="text-muted-foreground mt-2 text-base">{t('no_token_provided_check_email')}</p>
      </div>
    );
  }

  const verified = await verifyEmail({ token });

  if (verified === null) {
    return (
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <AlertTriangle className="h-10 w-10 text-yellow-500" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">{t('something_went_wrong')}</h2>

          <p className="text-muted-foreground mt-4">{t('unable_to_verify_email')}</p>

          <Button className="mt-4" asChild>
            <Link href="/">{t('go_back_home')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">{t('your_token_has_expired')}</h2>

          <p className="text-muted-foreground mt-4">{t('sent_you_another_token')}</p>

          <Button className="mt-4" asChild>
            <Link href="/">{t('go_back_home')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start">
      <div className="mr-4 mt-1 hidden md:block">
        <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={2} />
      </div>

      <div>
        <h2 className="text-2xl font-bold md:text-4xl">{t('email_confirmed')}</h2>

        <p className="text-muted-foreground mt-4">{t('email_has_been_succsessfully_confirmed')}</p>

        <Button className="mt-4" asChild>
          <Link href="/">{t('go_back_home')}</Link>
        </Button>
      </div>
    </div>
  );
}
