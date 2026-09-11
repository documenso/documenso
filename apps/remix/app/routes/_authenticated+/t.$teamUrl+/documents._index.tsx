import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, FolderType, type DocumentStatus as PrismaDocumentStatus } from '@prisma/client';
import { XIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { EnvelopesBulkCancelDialog } from '~/components/dialogs/envelopes-bulk-cancel-dialog';
import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import {
  type EnvelopeBulkDownloadItem,
  EnvelopesBulkDownloadDialog,
} from '~/components/dialogs/envelopes-bulk-download-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { DocumentSearch } from '~/components/general/document/document-search';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { DocumentsTable } from '~/components/tables/documents-table';
import { DocumentsTableEmptyState } from '~/components/tables/documents-table-empty-state';
import { DocumentsTablePeriodFilter } from '~/components/tables/documents-table-period-filter';
import { DocumentsTableSenderFilter } from '~/components/tables/documents-table-sender-filter';
import { DocumentsTableStatusFilter } from '~/components/tables/documents-table-status-filter';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { useCurrentTeam } from '~/providers/team';
import { documentsSearchParams } from '~/utils/documents-search-params';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Documents`);
}

type EnvelopeMetaCache = Record<string, { title: string; status: PrismaDocumentStatus; isLegacy: boolean }>;

// Stable initial values: `useSessionStorage` keeps its setter identity stable
// only while the initial value reference is stable, and the metadata cache
// effect below depends on that setter.
const EMPTY_ROW_SELECTION: RowSelectionState = {};
const EMPTY_ENVELOPE_META_CACHE: EnvelopeMetaCache = {};

export default function DocumentsPage() {
  const team = useCurrentTeam();

  const { folderId } = useParams();
  const navigate = useNavigate();

  const documentsPath = formatDocumentsPath(team.url);

  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<string | null>(null);

  // Scoped by team so selections made in one team never leak into another.
  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>(
    `documents-bulk-selection-${team.id}`,
    EMPTY_ROW_SELECTION,
  );
  const [envelopeMetaCache, setEnvelopeMetaCache] = useSessionStorage<EnvelopeMetaCache>(
    `documents-bulk-selection-meta-${team.id}`,
    EMPTY_ENVELOPE_META_CACHE,
  );
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDownloadDialogOpen, setIsBulkDownloadDialogOpen] = useState(false);
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
    [ExtendedDocumentStatus.EXPIRED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  });

  const [findDocumentSearchParams, setFindDocumentSearchParams] = useQueryStates(documentsSearchParams, {
    history: 'push',
  });

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery(
    {
      status: findDocumentSearchParams.status ?? undefined,
      period: findDocumentSearchParams.period ?? undefined,
      senderIds: findDocumentSearchParams.senderIds ?? undefined,
      page: findDocumentSearchParams.page ?? undefined,
      perPage: findDocumentSearchParams.perPage ?? undefined,
      query: findDocumentSearchParams.query ?? undefined,
      folderId,
    },
    {
      ...SKIP_QUERY_BATCH_META,
    },
  );

  useEffect(() => {
    setEnvelopeMetaCache((prev) => {
      const next: EnvelopeMetaCache = {};

      for (const id of Object.keys(prev)) {
        if (rowSelection[id]) {
          next[id] = prev[id];
        }
      }

      for (const document of data?.data ?? []) {
        if (rowSelection[document.envelopeId]) {
          next[document.envelopeId] = {
            title: document.title,
            status: document.status,
            isLegacy: document.internalVersion === 1,
          };
        }
      }

      return next;
    });
  }, [data?.data, rowSelection, setEnvelopeMetaCache]);

  const selectedEnvelopesForDownload = useMemo(() => {
    return selectedEnvelopeIds
      .map((id): EnvelopeBulkDownloadItem | null => {
        const meta = envelopeMetaCache[id];

        if (!meta) {
          return null;
        }

        return {
          id,
          title: meta.title,
          status: meta.status,
          // Stale cache entries predating this field are treated as legacy so
          // the Partial option is never offered without certainty.
          isLegacy: meta.isLegacy ?? true,
        };
      })
      .filter((item): item is EnvelopeBulkDownloadItem => item !== null);
  }, [selectedEnvelopeIds, envelopeMetaCache]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      (findDocumentSearchParams.status && findDocumentSearchParams.status !== ExtendedDocumentStatus.ALL) ||
        findDocumentSearchParams.senderIds?.length ||
        findDocumentSearchParams.period,
    );
  }, [findDocumentSearchParams]);

  const onResetFilters = () => {
    void setFindDocumentSearchParams({
      status: null,
      senderIds: null,
      period: null,
      page: null,
    });
  };

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.DOCUMENT}>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <FolderGrid type={FolderType.DOCUMENT} parentId={folderId ?? null} />

        <div className="mt-8 flex flex-row items-center">
          <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
            {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
            <AvatarFallback className="text-muted-foreground text-xs">{team.name.slice(0, 1)}</AvatarFallback>
          </Avatar>

          <h2 className="font-semibold text-4xl">
            <Trans>Documents</Trans>
          </h2>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-4">
          <div className="w-56">
            <DocumentSearch />
          </div>

          <DocumentsTableStatusFilter stats={stats} />

          {team && <DocumentsTableSenderFilter teamId={team.id} />}

          <DocumentsTablePeriodFilter />

          {hasActiveFilters && (
            <Button variant="ghost" className="px-2 text-muted-foreground lg:px-3" onClick={onResetFilters}>
              <Trans>Reset</Trans>
              <XIcon className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-8">
          <div>
            {data && data.count === 0 ? (
              <DocumentsTableEmptyState status={findDocumentSearchParams.status ?? ExtendedDocumentStatus.ALL} />
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
          onDownloadClick={() => setIsBulkDownloadDialogOpen(true)}
          onMoveClick={() => setIsBulkMoveDialogOpen(true)}
          onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
          onCancelClick={() => setIsBulkCancelDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />

        <EnvelopesBulkDownloadDialog
          envelopes={selectedEnvelopesForDownload}
          open={isBulkDownloadDialogOpen}
          onOpenChange={setIsBulkDownloadDialogOpen}
          onSuccess={(successfulEnvelopeIds) => {
            setRowSelection((prev) => {
              const next = { ...prev };
              for (const id of successfulEnvelopeIds) {
                delete next[id];
              }
              return next;
            });
          }}
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
