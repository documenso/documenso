import {
  createZipWriter,
  sanitizeZipPathSegment,
  type ZipFileEntry,
} from '@documenso/lib/client-only/create-zip-writer';
import { downloadFile } from '@documenso/lib/client-only/download-file';
import { fetchPDF } from '@documenso/lib/client-only/download-pdf';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { RadioGroupSegmented, RadioGroupSegmentedItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { match } from 'ts-pattern';

/**
 * The maximum number of documents that can be downloaded in a single bulk
 * download. Each document requires fetching its full PDFs into the browser,
 * so this bounds both request volume and blob storage usage. Matches the
 * spirit of the server-side 100 cap on bulk move/delete/cancel.
 */
export const MAX_BULK_DOWNLOAD_ENVELOPES = 50;

type BulkDownloadVersion = 'signed' | 'original' | 'pending';

export type EnvelopeBulkDownloadItem = {
  id: string;
  title: string;
  status: DocumentStatus;

  /**
   * Whether the envelope is a legacy (v1) envelope. Legacy envelopes use a
   * different field-rendering pipeline that the partial PDF helper does not
   * implement, so the Partial option is hidden for them.
   */
  isLegacy: boolean;
};

const getDefaultVersion = (envelope: EnvelopeBulkDownloadItem): BulkDownloadVersion =>
  envelope.status === DocumentStatus.COMPLETED ? 'signed' : 'original';

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

  const [versionMap, setVersionMap] = useState<Record<string, BulkDownloadVersion>>({});
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const abortRef = useRef(false);

  const trpcUtils = trpc.useUtils();

  const isOverDownloadLimit = envelopes.length > MAX_BULK_DOWNLOAD_ENVELOPES;

  useEffect(() => {
    if (!open) {
      return;
    }

    setVersionMap(Object.fromEntries(envelopes.map((envelope) => [envelope.id, getDefaultVersion(envelope)])));
    setProgress(0);
  }, [open]);

  const getDownloadVersion = (envelope: EnvelopeBulkDownloadItem): BulkDownloadVersion =>
    versionMap[envelope.id] ?? getDefaultVersion(envelope);

  /**
   * The version options selectable for an envelope, mirroring the gating used
   * by the single envelope download dialog:
   *   - COMPLETED: signed or original.
   *   - PENDING (non-legacy): partial or original. Legacy envelopes use a
   *     field-rendering pipeline the partial PDF helper does not implement.
   *   - Anything else: original only, so no choice is shown.
   */
  const getVersionOptions = (
    envelope: EnvelopeBulkDownloadItem,
  ): { value: BulkDownloadVersion; label: string }[] | null => {
    if (envelope.status === DocumentStatus.COMPLETED) {
      return [
        { value: 'signed', label: t({ message: 'Signed', context: 'Signed document (adjective)' }) },
        { value: 'original', label: t({ message: 'Original', context: 'Original document (adjective)' }) },
      ];
    }

    if (envelope.status === DocumentStatus.PENDING && !envelope.isLegacy) {
      return [
        { value: 'pending', label: t({ message: 'Partial', context: 'Partially signed document (adjective)' }) },
        { value: 'original', label: t({ message: 'Original', context: 'Original document (adjective)' }) },
      ];
    }

    return null;
  };

  const getStatusLabel = (status: DocumentStatus) =>
    match(status)
      .with(DocumentStatus.COMPLETED, () => t`Completed`)
      .with(DocumentStatus.PENDING, () => t`Pending`)
      .with(DocumentStatus.DRAFT, () => t`Draft`)
      .with(DocumentStatus.REJECTED, () => t`Rejected`)
      .with(DocumentStatus.CANCELLED, () => t`Cancelled`)
      .exhaustive();

  const onDownload = async () => {
    if (envelopes.length === 0 || isOverDownloadLimit || isDownloading) {
      return;
    }

    abortRef.current = false;
    setIsDownloading(true);
    setProgress(0);

    const zipWriter = createZipWriter();

    const successfulEnvelopeIds: string[] = [];
    let failedDownloads = 0;

    try {
      for (const envelope of envelopes) {
        if (abortRef.current) {
          break;
        }

        try {
          const downloadVersion = getDownloadVersion(envelope);

          const { data: envelopeItems } = await trpcUtils.envelope.item.getManyByToken.fetch({
            envelopeId: envelope.id,
            access: {
              type: 'user',
            },
          });

          // Each envelope's items are grouped in their own folder. The id
          // prefix guarantees uniqueness, the truncated title keeps it
          // readable without risking overly long extraction paths.
          const folderName = sanitizeZipPathSegment(`${envelope.id}_${envelope.title}`.slice(0, 96));

          // Buffer this envelope's files before writing so a failed envelope
          // is either fully in the zip or not at all. Files from previous
          // envelopes have already been written to the zip stream and freed.
          const envelopeFiles: ZipFileEntry[] = [];

          for (const envelopeItem of envelopeItems) {
            const { filename, blob } = await fetchPDF({
              envelopeItem,
              token: undefined,
              fileName: envelopeItem.title,
              version: downloadVersion,
            });

            envelopeFiles.push({
              filename: `${folderName}/${sanitizeZipPathSegment(filename)}`,
              data: blob,
            });
          }

          for (const file of envelopeFiles) {
            await zipWriter.addFile(file);
          }

          successfulEnvelopeIds.push(envelope.id);
        } catch (error) {
          console.error(error);
          failedDownloads++;
        }

        setProgress((p) => p + 1);
      }

      // The user intentionally stopped the download, discard anything fetched
      // so far without toasting an error.
      if (abortRef.current) {
        zipWriter.abort();
        return;
      }

      if (successfulEnvelopeIds.length === 0) {
        zipWriter.abort();

        toast({
          title: t`Error`,
          description: t`An error occurred while downloading the documents.`,
          variant: 'destructive',
        });
        return;
      }

      try {
        downloadFile({
          filename: `documenso-documents-${new Date().toISOString().slice(0, 10)}.zip`,
          data: zipWriter.finalize(),
        });
      } catch (error) {
        console.error(error);

        zipWriter.abort();

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

        {isOverDownloadLimit && (
          <Alert variant="warning">
            <AlertDescription>
              <Trans>
                You can download up to{' '}
                <Plural value={MAX_BULK_DOWNLOAD_ENVELOPES} one="document" other="documents" /> at a time. Deselect
                some documents to continue.
              </Trans>
            </AlertDescription>
          </Alert>
        )}

        <fieldset disabled={isDownloading} className="space-y-4">
          <div className="-mx-3 max-h-96 overflow-y-auto px-3">
            <div className="divide-y divide-border rounded-lg border border-border">
              {envelopes.map((envelope) => {
                const versionOptions = getVersionOptions(envelope);

                return (
                  <div key={envelope.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground text-sm" title={envelope.title}>
                        {envelope.title}
                      </p>
                      <p className="text-muted-foreground text-xs">{getStatusLabel(envelope.status)}</p>
                    </div>

                    {versionOptions && (
                      <RadioGroupSegmented
                        className="shrink-0"
                        value={getDownloadVersion(envelope)}
                        onValueChange={(value) =>
                          setVersionMap((prev) => ({
                            ...prev,
                            [envelope.id]: value as BulkDownloadVersion,
                          }))
                        }
                        aria-label={t`Download version for ${envelope.title}`}
                      >
                        {versionOptions.map((option) => (
                          <RadioGroupSegmentedItem key={option.value} value={option.value}>
                            {option.label}
                          </RadioGroupSegmentedItem>
                        ))}
                      </RadioGroupSegmented>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isDownloading && (
            <p className="text-muted-foreground text-sm">
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
              disabled={envelopes.length === 0 || isOverDownloadLimit}
            >
              <Trans>Download</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
