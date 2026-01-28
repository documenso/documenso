import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

type DocumentDuplicateDialogProps = {
  id: string;
  token?: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const DocumentDuplicateDialog = ({
  id,
  token,
  open,
  onOpenChange,
}: DocumentDuplicateDialogProps) => {
  const navigate = useNavigate();

  const { toast } = useToast();
  const { _ } = useLingui();

  const team = useCurrentTeam();

  const { data: envelopeItemsPayload, isLoading: isLoadingEnvelopeItems } =
    trpcReact.envelope.item.getManyByToken.useQuery(
      {
        envelopeId: id,
        access: token ? { type: 'recipient', token } : { type: 'user' },
      },
      {
        enabled: open,
      },
    );

  const envelopeItems = envelopeItemsPayload?.data || [];

  const documentsPath = formatDocumentsPath(team.url);

  const { mutateAsync: duplicateEnvelope, isPending: isDuplicating } =
    trpcReact.envelope.duplicate.useMutation({
      onSuccess: async ({ id }) => {
        toast({
          title: _(msg`Document Duplicated`),
          description: _(msg`Your document has been successfully duplicated.`),
          duration: 5000,
        });

        await navigate(`${documentsPath}/${id}/edit`);
        onOpenChange(false);
      },
    });

  const onDuplicate = async () => {
    try {
      await duplicateEnvelope({ envelopeId: id });
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`This document could not be duplicated at this time. Please try again.`),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isDuplicating && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Duplicate</Trans>
          </DialogTitle>
        </DialogHeader>
        {isLoadingEnvelopeItems || !envelopeItems || envelopeItems.length === 0 ? (
          <div className="mx-auto -mt-4 flex w-full max-w-screen-xl flex-col px-4 md:px-8">
            <h1 className="mt-4 grow-0 truncate text-2xl font-semibold md:text-3xl">
              <Trans>Loading Document...</Trans>
            </h1>
          </div>
        ) : (
          <div className="p-2 [&>div]:h-[50vh] [&>div]:overflow-y-scroll">
            <PDFViewerLazy
              key={envelopeItems[0].id}
              envelopeItem={envelopeItems[0]}
              token={undefined}
              version="original"
            />
          </div>
        )}

        <DialogFooter>
          <div className="flex w-full flex-1 flex-nowrap gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              disabled={isDuplicating}
              loading={isDuplicating}
              onClick={onDuplicate}
              className="flex-1"
            >
              <Trans>Duplicate</Trans>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
