import { useEffect, useState } from 'react';

import { plural } from '@lingui/core/macro';
import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { match } from 'ts-pattern';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type EnvelopeBulkDownloadItem = {
  id: string;
  title: string;
  status: DocumentStatus;
};

export type EnvelopesBulkDownloadDialogProps = {
  envelopes: EnvelopeBulkDownloadItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

type DownloadVersion = 'signed' | 'original';

export const EnvelopesBulkDownloadDialog = ({
  envelopes,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkDownloadDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [versionMap, setVersionMap] = useState<Record<string, DownloadVersion>>({});
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    if (!open) {
      return;
    }

    setVersionMap(
      Object.fromEntries(
        envelopes.map((envelope) => [
          envelope.id,
          envelope.status === DocumentStatus.COMPLETED ? 'signed' : 'original',
        ]),
      ),
    );
    setProgress(0);
    // Only reset selections/progress when the dialog transitions to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getStatusLabel = (status: DocumentStatus) =>
    match(status)
      .with(DocumentStatus.COMPLETED, () => t`Completed`)
      .with(DocumentStatus.PENDING, () => t`Pending`)
      .with(DocumentStatus.DRAFT, () => t`Draft`)
      .with(DocumentStatus.REJECTED, () => t`Rejected`)
      .exhaustive();

  const onDownload = async () => {
    if (envelopes.length === 0 || isDownloading) {
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    let successfulDownloads = 0;
    let failedDownloads = 0;

    try {
      for (let index = 0; index < envelopes.length; index++) {
        const envelope = envelopes[index];

        try {
          const downloadVersion: DownloadVersion =
            versionMap[envelope.id] === 'signed' && envelope.status === DocumentStatus.COMPLETED
              ? 'signed'
              : 'original';

          const { data: envelopeItems } = await trpcUtils.envelope.item.getManyByToken.fetch({
            envelopeId: envelope.id,
            access: {
              type: 'user',
            },
          });

          for (const envelopeItem of envelopeItems) {
            await downloadPDF({
              envelopeItem,
              token: undefined,
              fileName: envelopeItem.title,
              version: downloadVersion,
            });
          }

          successfulDownloads++;
        } catch (error) {
          console.error(error);
          failedDownloads++;
        }

        setProgress(index + 1);
      }

      if (successfulDownloads === 0) {
        toast({
          title: t`Error`,
          description: t`An error occurred while downloading the documents.`,
          variant: 'destructive',
        });

        return;
      }

      if (failedDownloads > 0) {
        toast({
          title: t`Documents partially downloaded`,
          description: t`${plural(successfulDownloads, {
            one: '# document downloaded.',
            other: '# documents downloaded.',
          })} ${plural(failedDownloads, {
            one: '# document could not be downloaded.',
            other: '# documents could not be downloaded.',
          })}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t`Documents downloaded`,
          description: plural(successfulDownloads, {
            one: '# document has been downloaded.',
            other: '# documents have been downloaded.',
          }),
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);

      toast({
        title: t`Error`,
        description: t`An error occurred while downloading the documents.`,
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => {
        if (!isDownloading) {
          onOpenChange(value);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Download Documents</Trans>
          </DialogTitle>

          <DialogDescription>
            <Plural
              value={envelopes.length}
              one="Select the version to download for the selected document."
              other="Select the version to download for each of the # selected documents."
            />
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={isDownloading} className="space-y-4">
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {envelopes.map((envelope) => {
              const isCompleted = envelope.status === DocumentStatus.COMPLETED;

              return (
                <div
                  key={envelope.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-foreground"
                      title={envelope.title}
                    >
                      {envelope.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getStatusLabel(envelope.status)}
                    </p>
                  </div>

                  {isCompleted && (
                    <Select
                      value={versionMap[envelope.id] ?? 'signed'}
                      onValueChange={(value) => {
                        if (value === 'signed' || value === 'original') {
                          setVersionMap((prev) => ({ ...prev, [envelope.id]: value }));
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px] flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="signed">
                          <Trans context="Signed document (adjective)">Signed</Trans>
                        </SelectItem>
                        <SelectItem value="original">
                          <Trans context="Original document (adjective)">Original</Trans>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>

          {isDownloading && (
            <p className="text-sm text-muted-foreground">
              <Trans>
                Downloading {progress} / {envelopes.length}...
              </Trans>
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isDownloading}
            >
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              onClick={() => void onDownload()}
              loading={isDownloading}
              disabled={envelopes.length === 0}
            >
              <Trans>Download</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
