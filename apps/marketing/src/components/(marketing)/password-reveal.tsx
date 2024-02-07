'use client';

import { useTranslation } from 'react-i18next';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PasswordRevealProps = {
  password: string;
};

export const PasswordReveal = ({ password }: PasswordRevealProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, copy] = useCopyToClipboard();

  const onCopyClick = () => {
    void copy(password).then(() => {
      toast({
        title: `${t('copied_to_clipboard')}`,
        description: `${t('password_has_been_copied_to_clipboard')}`,
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
