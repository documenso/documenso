import { useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { Bird } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';

import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { FolderType } from '@documenso/lib/types/folder-type';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';

import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesPage() {
  const team = useCurrentTeam();

  const { folderId } = useParams();
  const [searchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;

  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>(
    'templates-bulk-selection',
    {},
  );
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  const selectedEnvelopeIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const documentRootPath = formatDocumentsPath(team.url);
  const templateRootPath = formatTemplatesPath(team.url);

  const { data, isLoading, isLoadingError } = trpc.template.findTemplates.useQuery({
    page: page,
    perPage: perPage,
    folderId,
  });

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.TEMPLATE}>
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        <FolderGrid type={FolderType.TEMPLATE} parentId={folderId ?? null} />

        <div className="mt-8">
          <div className="flex flex-row items-center">
            <Avatar className="mr-3 h-12 w-12 border-2 border-solid border-white dark:border-border">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-xs text-muted-foreground">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <h1 className="truncate text-2xl font-semibold md:text-3xl">
              <Trans>Templates</Trans>
            </h1>
          </div>

          <div className="mt-8">
            {data && data.count === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
                <Bird className="h-12 w-12" strokeWidth={1.5} />

                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    <Trans>We're all empty</Trans>
                  </h3>

                  <p className="mt-2 max-w-[50ch]">
                    <Trans>
                      You have not yet created any templates. To create a template please upload
                      one.
                    </Trans>
                  </p>
                </div>
              </div>
            ) : (
              <TemplatesTable
                data={data}
                isLoading={isLoading}
                isLoadingError={isLoadingError}
                documentRootPath={documentRootPath}
                templateRootPath={templateRootPath}
                enableSelection
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            )}
          </div>
        </div>

        <EnvelopesTableBulkActionBar
          selectedCount={selectedEnvelopeIds.length}
          onMoveClick={() => setIsBulkMoveDialogOpen(true)}
          onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />

        <EnvelopesBulkMoveDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.TEMPLATE}
          open={isBulkMoveDialogOpen}
          currentFolderId={folderId}
          onOpenChange={setIsBulkMoveDialogOpen}
          onSuccess={() => setRowSelection({})}
        />

        <EnvelopesBulkDeleteDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.TEMPLATE}
          open={isBulkDeleteDialogOpen}
          onOpenChange={setIsBulkDeleteDialogOpen}
          onSuccess={() => setRowSelection({})}
        />
      </div>
    </EnvelopeDropZoneWrapper>
  );
}
