import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getResetTokenValidity } from '@documenso/lib/server-only/user/get-reset-token-validity';

import initTranslations from '~/app/i18n';
import { ResetPasswordForm } from '~/components/forms/reset-password';

type ResetPasswordPageProps = {
  params: {
    locale: string;
    token: string;
  };
};

export default async function ResetPasswordPage({
  params: { locale, token },
}: ResetPasswordPageProps) {
  const isValid = await getResetTokenValidity({ token });
  const { t } = await initTranslations(locale);

  if (!isValid) {
    redirect('/reset-password');
  }

  return (
    <div className="w-full">
      <h1 className="text-4xl font-semibold">{t('reset_password')}</h1>

      <p className="text-muted-foreground mt-2 text-sm">{t('please_choose_your_new_password')}</p>

      <ResetPasswordForm token={token} className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('dont_have_an_account')}{' '}
        <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
          {t('sign_up')}
        </Link>
      </p>
    </div>
  );
}
