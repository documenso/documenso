import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { ZFindDocumentsInternalRequestSchema } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';
import type { DataTableFacetedFilterOption } from '@documenso/ui/primitives/data-table-faceted-filter';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, FolderType, OrganisationType } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { z } from 'zod';

import { EnvelopesBulkCancelDialog } from '~/components/dialogs/envelopes-bulk-cancel-dialog';
import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { FRIENDLY_STATUS_MAP } from '~/components/general/document/document-status';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { DocumentsTable } from '~/components/tables/documents-table';
import { DocumentsTableEmptyState } from '~/components/tables/documents-table-empty-state';
import { DocumentsTableToolbar } from '~/components/tables/documents-table-toolbar';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Documents`);
}

const ZSearchParamsSchema = ZFindDocumentsInternalRequestSchema.pick({
  status: true,
  period: true,
  page: true,
  perPage: true,
  query: true,
}).extend({
  senderIds: z.string().transform(parseToIntegerArray).optional().catch([]),
});

export default function DocumentsPage() {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const documentsPath = formatDocumentsPath(team.url);

  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<string | null>(null);

  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>('documents-bulk-selection', {});
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkCancelDialogOpen, setIsBulkCancelDialogOpen] = useState(false);

  const selectedEnvelopeIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const [stats, setStats] = useState<TFindDocumentsInternalResponse['stats']>({
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.REJECTED]: 0,
    [ExtendedDocumentStatus.CANCELLED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  });

  const findDocumentSearchParams = useMemo(
    () => ZSearchParamsSchema.safeParse(Object.fromEntries(searchParams.entries())).data || {},
    [searchParams],
  );

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery(
    {
      ...findDocumentSearchParams,
      folderId,
    },
    {
      ...SKIP_QUERY_BATCH_META,
    },
  );

  const statusOptions = useMemo<DataTableFacetedFilterOption[]>(() => {
    return [
      ExtendedDocumentStatus.INBOX,
      ExtendedDocumentStatus.PENDING,
      ExtendedDocumentStatus.COMPLETED,
      ExtendedDocumentStatus.CANCELLED,
      ExtendedDocumentStatus.DRAFT,
      ExtendedDocumentStatus.REJECTED,
    ]
      .filter((status) => {
        if (organisation.type === OrganisationType.PERSONAL) {
          return status !== ExtendedDocumentStatus.INBOX;
        }

        return true;
      })
      .map((status) => {
        const { label, icon, color } = FRIENDLY_STATUS_MAP[status];

        return {
          label: _(label),
          value: status,
          icon,
          iconClassName: color,
        };
      });
  }, [organisation.type, _]);

  const selectedStatuses = findDocumentSearchParams.status ?? [];

  const selectedStatus = selectedStatuses.length === 1 ? selectedStatuses[0] : ExtendedDocumentStatus.ALL;

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.DOCUMENT}>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <FolderGrid type={FolderType.DOCUMENT} parentId={folderId ?? null} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
          <div className="flex flex-row items-center">
            <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-muted-foreground text-xs">{team.name.slice(0, 1)}</AvatarFallback>
            </Avatar>

            <h2 className="font-semibold text-4xl">
              <Trans>Documents</Trans>
            </h2>
          </div>
        </div>

        <div className="mt-8">
          <DocumentsTableToolbar teamId={team?.id} statusOptions={statusOptions} statusCounts={stats} />
        </div>

        <div className="mt-8">
          <div>
            {data && data.count === 0 ? (
              <DocumentsTableEmptyState status={selectedStatus} />
            ) : (
              <DocumentsTable
                data={data}
                isLoading={isLoading}
                isLoadingError={isLoadingError}
                onMoveDocument={(envelopeId) => {
                  setDocumentToMove(envelopeId);
                  setIsMovingDocument(true);
                }}
                enableSelection
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            )}
          </div>
        </div>

        {documentToMove && (
          <EnvelopesBulkMoveDialog
            envelopeIds={[documentToMove]}
            envelopeType={EnvelopeType.DOCUMENT}
            open={isMovingDocument}
            currentFolderId={folderId}
            onOpenChange={(open) => {
              setIsMovingDocument(open);

              if (!open) {
                setDocumentToMove(null);
              }
            }}
            onSuccess={(destinationFolderId) =>
              navigate(destinationFolderId ? `${documentsPath}/f/${destinationFolderId}` : documentsPath)
            }
          />
        )}

        <EnvelopesTableBulkActionBar
          selectedCount={selectedEnvelopeIds.length}
          onMoveClick={() => setIsBulkMoveDialogOpen(true)}
          onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
          onCancelClick={() => setIsBulkCancelDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />

        <EnvelopesBulkMoveDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.DOCUMENT}
          open={isBulkMoveDialogOpen}
          currentFolderId={folderId}
          onOpenChange={setIsBulkMoveDialogOpen}
          onSuccess={() => setRowSelection({})}
        />

        <EnvelopesBulkDeleteDialog
          envelopeIds={selectedEnvelopeIds}
          envelopeType={EnvelopeType.DOCUMENT}
          open={isBulkDeleteDialogOpen}
          onOpenChange={setIsBulkDeleteDialogOpen}
          onSuccess={() => setRowSelection({})}
        />

        <EnvelopesBulkCancelDialog
          envelopeIds={selectedEnvelopeIds}
          open={isBulkCancelDialogOpen}
          onOpenChange={setIsBulkCancelDialogOpen}
          onSuccess={() => setRowSelection({})}
        />
      </div>
    </EnvelopeDropZoneWrapper>
  );
}
