import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, type EnvelopeItem } from '@prisma/client';
import { DownloadIcon, FileTextIcon } from 'lucide-react';

import { downloadPDF } from '@documenso/lib/client-only/download-pdf';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useToast } from '@documenso/ui/primitives/use-toast';

type EnvelopeItemToDownload = Pick<EnvelopeItem, 'id' | 'envelopeId' | 'title' | 'order'>;

type EnvelopeDownloadDialogProps = {
  envelopeId: string;
  envelopeStatus: DocumentStatus;
  envelopeItems?: EnvelopeItemToDownload[];

  /**
   * The recipient token to download the document.
   *
   * If not provided, it will be assumed that the current user can access the document.
   */
  token?: string;
  trigger: React.ReactNode;
};

export const EnvelopeDownloadDialog = ({
  envelopeId,
  envelopeStatus,
  envelopeItems: initialEnvelopeItems,
  token,
  trigger,
}: EnvelopeDownloadDialogProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const [open, setOpen] = useState(false);

  const [isDownloadingState, setIsDownloadingState] = useState<{
    [envelopeItemIdAndVersion: string]: boolean;
  }>({});

  const generateDownloadKey = (envelopeItemId: string, version: 'original' | 'signed') =>
    `${envelopeItemId}-${version}`;

  const { data: envelopeItemsPayload, isLoading: isLoadingEnvelopeItems } =
    trpc.envelope.item.getManyByToken.useQuery(
      {
        envelopeId,
        access: token ? { type: 'recipient', token } : { type: 'user' },
      },
      {
        initialData: initialEnvelopeItems ? { data: initialEnvelopeItems } : undefined,
        enabled: open,
      },
    );

  const envelopeItems = envelopeItemsPayload?.data || [];

  const onDownload = async (
    envelopeItem: EnvelopeItemToDownload,
    version: 'original' | 'signed',
  ) => {
    const { id: envelopeItemId } = envelopeItem;

    if (isDownloadingState[generateDownloadKey(envelopeItemId, version)]) {
      return;
    }

    setIsDownloadingState((prev) => ({
      ...prev,
      [generateDownloadKey(envelopeItemId, version)]: true,
    }));

    try {
      await downloadPDF({
        envelopeItem,
        token,
        fileName: envelopeItem.title,
        version,
      });

      setIsDownloadingState((prev) => ({
        ...prev,
        [generateDownloadKey(envelopeItemId, version)]: false,
      }));
    } catch (error) {
      setIsDownloadingState((prev) => ({
        ...prev,
        [generateDownloadKey(envelopeItemId, version)]: false,
      }));

      console.error(error);

      toast({
        title: t`Something went wrong`,
        description: t`This document could not be downloaded at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Download Files</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Select the files you would like to download.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col gap-4 overflow-hidden">
          {isLoadingEnvelopeItems ? (
            <>
              {Array.from({ length: 1 }).map((_, index) => (
                <div
                  key={index}
                  className="border-border bg-card flex items-center gap-2 rounded-lg border p-4"
                >
                  <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />

                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-28 rounded-lg" />
                    <Skeleton className="h-4 w-20 rounded-lg" />
                  </div>

                  <Skeleton className="h-10 w-20 flex-shrink-0 rounded-lg" />
                </div>
              ))}
            </>
          ) : (
            envelopeItems.map((item) => (
              <div
                key={item.id}
                className="border-border bg-card hover:bg-accent/50 flex items-center gap-4 rounded-lg border p-4 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                    <FileTextIcon className="text-primary h-5 w-5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Todo: Envelopes - Fix overflow */}
                  <h4 className="text-foreground truncate text-sm font-medium" title={item.title}>
                    {item.title}
                  </h4>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    <Trans>PDF Document</Trans>
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={async () => onDownload(item, 'original')}
                    loading={isDownloadingState[generateDownloadKey(item.id, 'original')]}
                  >
                    {!isDownloadingState[generateDownloadKey(item.id, 'original')] && (
                      <DownloadIcon className="mr-2 h-4 w-4" />
                    )}
                    <Trans context="Original document (adjective)">Original</Trans>
                  </Button>

                  {envelopeStatus === DocumentStatus.COMPLETED && (
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs"
                      onClick={async () => onDownload(item, 'signed')}
                      loading={isDownloadingState[generateDownloadKey(item.id, 'signed')]}
                    >
                      {!isDownloadingState[generateDownloadKey(item.id, 'signed')] && (
                        <DownloadIcon className="mr-2 h-4 w-4" />
                      )}
                      <Trans context="Signed document (adjective)">Signed</Trans>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
