import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
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
};

export const RecoveryCodesDialog = ({
  onOpenChange,
  open,
  backupCodes,
}: RecoveryCodesDialogProps) => {
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

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
        title: 'Copied to clipboard',
        description: 'Your backup codes has been copied to your clipboard.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Two-factor recovery codes</DialogTitle>
          <DialogDescription>
            In case you lose access to your device and are unable to receive two-factor
            authentication codes, recovery codes can be employed to regain access to your account.
          </DialogDescription>
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
            Copy
          </Button>
          <Button onClick={handleDownload}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
