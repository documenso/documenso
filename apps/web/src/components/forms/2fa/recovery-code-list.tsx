import { Copy } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type RecoveryCodeListProps = {
  recoveryCodes: string[];
};

export const RecoveryCodeList = ({ recoveryCodes }: RecoveryCodeListProps) => {
  const { toast } = useToast();
  const [, copyToClipboard] = useCopyToClipboard();

  const onCopyRecoveryCodeClick = async (code: string) => {
    try {
      const result = await copyToClipboard(code);

      if (!result) {
        throw new Error('აღდგენის კოდის დაკოპირება ვერ მოხერხდა');
      }

      toast({
        title: 'აღდგენის კოდი დაკოპირებული',
        description: 'თქვენი აღდგენის კოდი წარმატებით დაკოპირდა.',
      });
    } catch (_err) {
      toast({
        title: 'აღდგენის კოდის დაკოპირება ვერ მოხერხდა',
        description:
          'თქვენი აღდგენის კოდის დაკოპირება ვერ მოხერხდა. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
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
