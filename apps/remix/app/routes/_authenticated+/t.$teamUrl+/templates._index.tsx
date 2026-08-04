import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { FolderType } from '@documenso/lib/types/folder-type';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, OrganisationType } from '@prisma/client';
import { Bird } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { TemplatesTable } from '~/components/tables/templates-table';
import { TemplatesTableViewFilter } from '~/components/tables/templates-table-view-filter';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';
import { templatesSearchParams } from '~/utils/templates-search-params';

export function meta() {
  return appMetaTags(msg`Templates`);
}

// Stable initial value: `useSessionStorage` keeps its setter identity stable
// only while the initial value reference is stable.
const EMPTY_ROW_SELECTION: RowSelectionState = {};

export default function TemplatesPage() {
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const { folderId } = useParams();
  const [findTemplateSearchParams] = useQueryStates(templatesSearchParams, {
    history: 'push',
  });

  const isOrgView = findTemplateSearchParams.view === 'organisation';
  const showOrgFilter = organisation.type !== OrganisationType.PERSONAL;

  // Scoped by team so selections made in one team never leak into another.
  const [rowSelection, setRowSelection] = useSessionStorage<RowSelectionState>(
    `templates-bulk-selection-${team.id}`,
    EMPTY_ROW_SELECTION,
  );
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  const selectedEnvelopeIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const documentRootPath = formatDocumentsPath(team.url);
  const templateRootPath = formatTemplatesPath(team.url);

  const teamTemplatesQuery = trpc.template.findTemplates.useQuery(
    {
      page: findTemplateSearchParams.page ?? undefined,
      perPage: findTemplateSearchParams.perPage ?? undefined,
      folderId,
    },
    {
      enabled: !isOrgView,
    },
  );

  const orgTemplatesQuery = trpc.template.findOrganisationTemplates.useQuery(
    {
      page: findTemplateSearchParams.page ?? undefined,
      perPage: findTemplateSearchParams.perPage ?? undefined,
    },
    {
      enabled: isOrgView,
    },
  );

  const activeQuery = isOrgView ? orgTemplatesQuery : teamTemplatesQuery;

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.TEMPLATE}>
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        {!isOrgView && <FolderGrid type={FolderType.TEMPLATE} parentId={folderId ?? null} />}

        <div className="mt-8">
          <div className="flex flex-row items-center">
            <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-muted-foreground text-xs">{team.name.slice(0, 1)}</AvatarFallback>
            </Avatar>

            <h1 className="truncate font-semibold text-2xl md:text-3xl">
              <Trans>Templates</Trans>
            </h1>
          </div>

          {showOrgFilter && (
            <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-4">
              <TemplatesTableViewFilter />
            </div>
          )}

          <div className="mt-8">
            {activeQuery.data && activeQuery.data.count === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
                <Bird className="h-12 w-12" strokeWidth={1.5} />

                <div className="text-center">
                  <h3 className="font-semibold text-lg">
                    <Trans>We're all empty</Trans>
                  </h3>

                  <p className="mt-2 max-w-[50ch]">
                    {isOrgView ? (
                      <Trans>No organisation templates are shared with your team yet.</Trans>
                    ) : (
                      <Trans>You have not yet created any templates. To create a template please upload one.</Trans>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <TemplatesTable
                data={activeQuery.data}
                isLoading={activeQuery.isLoading}
                isLoadingError={activeQuery.isLoadingError}
                documentRootPath={documentRootPath}
                templateRootPath={templateRootPath}
                enableSelection={!isOrgView}
                rowSelection={isOrgView ? {} : rowSelection}
                onRowSelectionChange={isOrgView ? undefined : setRowSelection}
              />
            )}
          </div>
        </div>

        {!isOrgView && (
          <>
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
          </>
        )}
      </div>
    </EnvelopeDropZoneWrapper>
  );
}
