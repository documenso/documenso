import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Copy } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type RecoveryCodeListProps = {
  recoveryCodes: string[];
};

export const RecoveryCodeList = ({ recoveryCodes }: RecoveryCodeListProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  const onCopyRecoveryCodeClick = async (code: string) => {
    try {
      const result = await copyToClipboard(code);

      if (!result) {
        throw new Error('Unable to copy recovery code');
      }

      toast({
        title: _(msg`Recovery code copied`),
        description: _(msg`Your recovery code has been copied to your clipboard.`),
      });
    } catch (_err) {
      toast({
        title: _(msg`Unable to copy recovery code`),
        description: _(
          msg`We were unable to copy your recovery code to your clipboard. Please try again.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {recoveryCodes.map((code) => (
        <div
          key={code}
          className="bg-muted text-muted-foreground relative rounded-lg p-4 font-mono md:text-center"
        >
          <span>{code}</span>

          <div className="absolute inset-y-0 right-4 flex items-center justify-center">
            <button
              className="opacity-60 hover:opacity-80"
              onClick={() => void onCopyRecoveryCodeClick(code)}
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
