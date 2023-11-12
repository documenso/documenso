import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

type RecoveryCodesDialogProps = {
  open: boolean;
  onOpenChange: (_val: boolean) => void;
  backupCodes: string[] | null;
  locale: LocaleTypes;
};

export const RecoveryCodesDialog = ({
  onOpenChange,
  open,
  backupCodes,
  locale,
}: RecoveryCodesDialogProps) => {
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();
  const { t } = useTranslation(locale, 'dashboard');
  const handleDownload = () => {
    if (backupCodes) {
      const textBlob = new Blob([backupCodes.join('\n')], {
        type: 'text/plain',
      });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(textBlob);
      downloadLink.download = 'documenso-2fa-backup-code.txt';

      downloadLink.click();

      URL.revokeObjectURL(downloadLink.href);

      downloadLink.remove();
    }
  };

  const handleCopy = async () => {
    if (backupCodes) {
      await copy(backupCodes.join('\n'));
      toast({
        title: t(`copied-to-clipboard`),
        description: t(`backup-copied-to-clipboard`),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`2fa-recovery-codes`)}</DialogTitle>
          <DialogDescription>{t(`in-case`)}</DialogDescription>
        </DialogHeader>

        {backupCodes && (
          <div className="bg-secondary mt-5 grid grid-cols-2 gap-1 rounded-md py-2 text-center font-mono md:pl-10 md:pr-10">
            {backupCodes.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={handleCopy}>
            {t(`copy`)}{' '}
          </Button>
          <Button onClick={handleDownload}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
