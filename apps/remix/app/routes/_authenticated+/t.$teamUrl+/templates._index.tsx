import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType, OrganisationType } from '@prisma/client';
import { Bird } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useParams, useSearchParams } from 'react-router';

import { useSessionStorage } from '@documenso/lib/client-only/hooks/use-session-storage';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { FolderType } from '@documenso/lib/types/folder-type';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import type { RowSelectionState } from '@documenso/ui/primitives/data-table';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { EnvelopesBulkDeleteDialog } from '~/components/dialogs/envelopes-bulk-delete-dialog';
import { EnvelopesBulkMoveDialog } from '~/components/dialogs/envelopes-bulk-move-dialog';
import { EnvelopeDropZoneWrapper } from '~/components/general/envelope/envelope-drop-zone-wrapper';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { EnvelopesTableBulkActionBar } from '~/components/tables/envelopes-table-bulk-action-bar';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

const TEMPLATE_VIEWS = ['team', 'organisation'] as const;

type TemplateView = (typeof TEMPLATE_VIEWS)[number];

export function meta() {
  return appMetaTags(msg`Templates`);
}

export default function TemplatesPage() {
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const { folderId } = useParams();
  const [searchParams] = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;

  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(TEMPLATE_VIEWS).withDefault('team'),
  );

  const isOrgView = view === 'organisation';
  const showOrgTab = organisation.type !== OrganisationType.PERSONAL;

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

  const teamTemplatesQuery = trpc.template.findTemplates.useQuery(
    {
      page,
      perPage,
      folderId,
    },
    {
      enabled: !isOrgView,
    },
  );

  const orgTemplatesQuery = trpc.template.findOrganisationTemplates.useQuery(
    {
      page,
      perPage,
    },
    {
      enabled: isOrgView,
    },
  );

  const activeQuery = isOrgView ? orgTemplatesQuery : teamTemplatesQuery;

  const handleViewChange = (newView: string) => {
    if (newView !== 'team' && newView !== 'organisation') {
      return;
    }

    void setView(newView === 'team' ? null : newView);
  };

  return (
    <EnvelopeDropZoneWrapper type={EnvelopeType.TEMPLATE}>
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        {!isOrgView && <FolderGrid type={FolderType.TEMPLATE} parentId={folderId ?? null} />}

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

          {showOrgTab && (
            <div className="mt-6">
              <Tabs value={view} onValueChange={handleViewChange} data-testid="template-view-tabs">
                <TabsList>
                  <TabsTrigger
                    className="min-w-[60px] hover:text-foreground"
                    value="team"
                    data-testid="template-tab-team"
                  >
                    <Trans>Team</Trans>
                  </TabsTrigger>
                  <TabsTrigger
                    className="min-w-[60px] hover:text-foreground"
                    value="organisation"
                    data-testid="template-tab-organisation"
                  >
                    <Trans>Organisation</Trans>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="mt-8">
            {activeQuery.data && activeQuery.data.count === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
                <Bird className="h-12 w-12" strokeWidth={1.5} />

                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    <Trans>We're all empty</Trans>
                  </h3>

                  <p className="mt-2 max-w-[50ch]">
                    {isOrgView ? (
                      <Trans>No organisation templates are shared with your team yet.</Trans>
                    ) : (
                      <Trans>
                        You have not yet created any templates. To create a template please upload
                        one.
                      </Trans>
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
