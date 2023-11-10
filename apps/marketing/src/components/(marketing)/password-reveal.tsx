'use client';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { createTranslation } from '@documenso/ui/i18n/server';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PasswordRevealProps = {
  password: string;
  locale: any;
};

export const PasswordReveal = async ({ password, locale }: PasswordRevealProps) => {
  const { toast } = useToast();
  const [, copy] = useCopyToClipboard();
  const { t } = await createTranslation(locale, 'marketing');

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
