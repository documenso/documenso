import { useEffect, useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { FolderIcon, HomeIcon, Loader2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { z } from 'zod';

import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import {
  type TFindDocumentsInternalResponse,
  ZFindDocumentsInternalRequestSchema,
} from '@documenso/trpc/server/document-router/schema';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { DocumentMoveToFolderDialog } from '~/components/dialogs/document-move-to-folder-dialog';
import { CreateFolderDialog } from '~/components/dialogs/folder-create-dialog';
import { FolderDeleteDialog } from '~/components/dialogs/folder-delete-dialog';
import { FolderMoveDialog } from '~/components/dialogs/folder-move-dialog';
import { FolderSettingsDialog } from '~/components/dialogs/folder-settings-dialog';
import { DocumentDropZoneWrapper } from '~/components/general/document/document-drop-zone-wrapper';
import { DocumentSearch } from '~/components/general/document/document-search';
import { DocumentStatus } from '~/components/general/document/document-status';
import { DocumentUploadDropzone } from '~/components/general/document/document-upload';
import { FolderCard } from '~/components/general/folder/folder-card';
import { PeriodSelector } from '~/components/general/period-selector';
import { DocumentsTable } from '~/components/tables/documents-table';
import { DocumentsTableEmptyState } from '~/components/tables/documents-table-empty-state';
import { DocumentsTableSenderFilter } from '~/components/tables/documents-table-sender-filter';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Documents');
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<number | null>(null);
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);

  const { folderId } = useParams();

  const team = useOptionalCurrentTeam();

  const { mutateAsync: pinFolder } = trpc.folder.pinFolder.useMutation();
  const { mutateAsync: unpinFolder } = trpc.folder.unpinFolder.useMutation();

  const [stats, setStats] = useState<TFindDocumentsInternalResponse['stats']>({
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.REJECTED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  });

  const findDocumentSearchParams = useMemo(
    () => ZSearchParamsSchema.safeParse(Object.fromEntries(searchParams.entries())).data || {},
    [searchParams],
  );

  const { data, isLoading, isLoadingError, refetch } = trpc.document.findDocumentsInternal.useQuery(
    {
      ...findDocumentSearchParams,
      folderId,
    },
  );

  const {
    data: foldersData,
    isLoading: isFoldersLoading,
    refetch: refetchFolders,
  } = trpc.folder.getFolders.useQuery({
    parentId: folderId,
  });

  useEffect(() => {
    void refetch();
    void refetchFolders();
  }, [team?.url]);

  const getTabHref = (value: keyof typeof ExtendedDocumentStatus) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (value === ExtendedDocumentStatus.ALL) {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    return `${formatDocumentsPath(team?.url)}/f/${folderId}?${params.toString()}`;
  };

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  const navigateToFolder = (folderId?: string | null) => {
    const documentsPath = formatDocumentsPath(team?.url);

    if (folderId) {
      void navigate(`${documentsPath}/f/${folderId}`);
    } else {
      void navigate(documentsPath);
    }
  };

  return (
    <DocumentDropZoneWrapper>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2 pl-0 hover:bg-transparent"
              onClick={() => navigateToFolder(null)}
            >
              <HomeIcon className="h-4 w-4" />
              <span>Home</span>
            </Button>

            {foldersData?.breadcrumbs.map((folder) => (
              <div key={folder.id} className="flex items-center space-x-2">
                <span>/</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-2 pl-1 hover:bg-transparent"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  <FolderIcon className="h-4 w-4" />
                  <span>{folder.name}</span>
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-4 sm:flex-row sm:justify-end">
            <DocumentUploadDropzone />
            <CreateFolderDialog />
          </div>
        </div>

        {isFoldersLoading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {foldersData?.folders && foldersData.folders.some((folder) => folder.pinned) && (
              <div className="mt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {foldersData.folders
                    .filter((folder) => folder.pinned)
                    .map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        onNavigate={navigateToFolder}
                        onMove={(folder) => {
                          setFolderToMove(folder);
                          setIsMovingFolder(true);
                        }}
                        onPin={(folderId) => void pinFolder({ folderId })}
                        onUnpin={(folderId) => void unpinFolder({ folderId })}
                        onSettings={(folder) => {
                          setFolderToSettings(folder);
                          setIsSettingsFolderOpen(true);
                        }}
                        onDelete={(folder) => {
                          setFolderToDelete(folder);
                          setIsDeletingFolder(true);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {foldersData?.folders
                  .filter((folder) => !folder.pinned)
                  .map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onNavigate={navigateToFolder}
                      onMove={(folder) => {
                        setFolderToMove(folder);
                        setIsMovingFolder(true);
                      }}
                      onPin={(folderId) => void pinFolder({ folderId })}
                      onUnpin={(folderId) => void unpinFolder({ folderId })}
                      onSettings={(folder) => {
                        setFolderToSettings(folder);
                        setIsSettingsFolderOpen(true);
                      }}
                      onDelete={(folder) => {
                        setFolderToDelete(folder);
                        setIsDeletingFolder(true);
                      }}
                    />
                  ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
          <div className="flex flex-row items-center">
            {team && (
              <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
                {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
                <AvatarFallback className="text-muted-foreground text-xs">
                  {team.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            )}

            <h2 className="text-4xl font-semibold">
              <Trans>Documents</Trans>
            </h2>
          </div>

          <div className="-m-1 flex flex-wrap gap-x-4 gap-y-6 overflow-hidden p-1">
            <Tabs value={findDocumentSearchParams.status || 'ALL'} className="overflow-x-auto">
              <TabsList>
                {[
                  ExtendedDocumentStatus.INBOX,
                  ExtendedDocumentStatus.PENDING,
                  ExtendedDocumentStatus.COMPLETED,
                  ExtendedDocumentStatus.DRAFT,
                  ExtendedDocumentStatus.ALL,
                ].map((value) => (
                  <TabsTrigger
                    key={value}
                    className="hover:text-foreground min-w-[60px]"
                    value={value}
                    asChild
                  >
                    <Link to={getTabHref(value)} preventScrollReset>
                      <DocumentStatus status={value} />

                      {value !== ExtendedDocumentStatus.ALL && (
                        <span className="ml-1 inline-block opacity-50">{stats[value]}</span>
                      )}
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {team && <DocumentsTableSenderFilter teamId={team.id} />}

            <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
              <PeriodSelector />
            </div>
            <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
              <DocumentSearch initialValue={findDocumentSearchParams.query} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div>
            {data &&
            data.count === 0 &&
            (!foldersData?.folders.length || foldersData.folders.length === 0) ? (
              <DocumentsTableEmptyState
                status={findDocumentSearchParams.status || ExtendedDocumentStatus.ALL}
              />
            ) : (
              <DocumentsTable
                data={data}
                isLoading={isLoading}
                isLoadingError={isLoadingError}
                onMoveDocument={(documentId) => {
                  setDocumentToMove(documentId);
                  setIsMovingDocument(true);
                }}
              />
            )}
          </div>
        </div>

        {documentToMove && (
          <DocumentMoveToFolderDialog
            documentId={documentToMove}
            open={isMovingDocument}
            onOpenChange={(open) => {
              setIsMovingDocument(open);

              if (!open) {
                setDocumentToMove(null);
              }
            }}
            currentFolderId={folderId}
          />
        )}

        <FolderMoveDialog
          foldersData={foldersData?.folders}
          folder={folderToMove}
          isOpen={isMovingFolder}
          onOpenChange={(open) => {
            setIsMovingFolder(open);

            if (!open) {
              setFolderToMove(null);
            }
          }}
        />

        <FolderSettingsDialog
          folder={folderToSettings}
          isOpen={isSettingsFolderOpen}
          onOpenChange={(open) => {
            setIsSettingsFolderOpen(open);

            if (!open) {
              setFolderToSettings(null);
            }
          }}
        />

        <FolderDeleteDialog
          folder={folderToDelete}
          isOpen={isDeletingFolder}
          onOpenChange={(open) => {
            setIsDeletingFolder(open);

            if (!open) {
              setFolderToDelete(null);
            }
          }}
        />
      </div>
    </DocumentDropZoneWrapper>
  );
}
