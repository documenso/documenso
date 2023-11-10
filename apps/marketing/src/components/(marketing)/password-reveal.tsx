'use client';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PasswordRevealProps = {
  password: string;
  locale: LocaleTypes;
};

export const PasswordReveal = ({ password, locale }: PasswordRevealProps) => {
  const { toast } = useToast();
  const [, copy] = useCopyToClipboard();
  const { t } = useTranslation(locale, 'marketing');

  const onCopyClick = () => {
    void copy(password).then(() => {
      toast({
        title: t(`copied-to-clipboard`),
        description: t(`password-copied-success`),
      });
    });
  };

  return (
    <button
      type="button"
      className="px-2 blur-sm hover:opacity-50 hover:blur-none"
      onClick={onCopyClick}
    >
      {password}
    </button>
  );
};
