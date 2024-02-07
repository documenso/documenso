import type { Metadata } from 'next';
import Link from 'next/link';

import { XCircle } from 'lucide-react';

import type { PageParams } from '@documenso/lib/types/page-params';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';

export const metadata: Metadata = {
  title: 'Verify Email',
};

export default async function EmailVerificationWithoutTokenPage({
  params: { locale },
}: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div className="flex w-full items-start">
      <div className="mr-4 mt-1 hidden md:block">
        <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
      </div>

      <div>
        <h2 className="text-2xl font-bold md:text-4xl">{t('missing_a_token')}</h2>

        <p className="text-muted-foreground mt-4">{t('follow_the_link_in_your_email')}</p>

        <Button className="mt-4" asChild>
          <Link href="/">{t('go_back_home')}</Link>
        </Button>
      </div>
    </div>
  );
}
