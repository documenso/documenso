import { useEffect, useRef, useState } from 'react';

import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
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
  onSuccess?: (successfulEnvelopeIds: string[]) => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopesBulkDownloadDialog = ({
  envelopes,
  open,
  onOpenChange,
  onSuccess,
  ...props
}: EnvelopesBulkDownloadDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [versionMap, setVersionMap] = useState<Record<string, 'signed' | 'original'>>({});
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const abortRef = useRef(false);

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

    abortRef.current = false;
    setIsDownloading(true);
    setProgress(0);

    const successfulEnvelopeIds: string[] = [];
    let failedDownloads = 0;

    try {
      for (const envelope of envelopes) {
        if (abortRef.current) {
          break;
        }

        try {
          const downloadVersion = versionMap[envelope.id] ?? 'original';

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

          successfulEnvelopeIds.push(envelope.id);
        } catch (error) {
          console.error(error);
          failedDownloads++;
        }

        setProgress((p) => p + 1);
      }

      if (successfulEnvelopeIds.length === 0) {
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
          description: t`${plural(successfulEnvelopeIds.length, {
            one: '# document downloaded.',
            other: '# documents downloaded.',
          })} ${plural(failedDownloads, {
            one: '# document could not be downloaded.',
            other: '# documents could not be downloaded.',
          })}`,
          variant: 'destructive',
        });
        onSuccess?.(successfulEnvelopeIds);
        return;
      }

      toast({
        title: t`Documents downloaded`,
        description: plural(successfulEnvelopeIds.length, {
          one: '# document has been downloaded.',
          other: '# documents have been downloaded.',
        }),
      });

      onSuccess?.(successfulEnvelopeIds);
      onOpenChange(false);
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
                      onValueChange={(value) =>
                        setVersionMap((prev) => ({
                          ...prev,
                          [envelope.id]: value as 'signed' | 'original',
                        }))
                      }
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
              onClick={() => {
                if (isDownloading) {
                  abortRef.current = true;
                } else {
                  onOpenChange(false);
                }
              }}
            >
              {isDownloading ? <Trans>Stop</Trans> : <Trans>Cancel</Trans>}
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
