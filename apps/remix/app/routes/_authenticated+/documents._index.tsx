import { useEffect, useMemo, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { FolderIcon, HomeIcon, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { DocumentMoveToFolderDialog } from '~/components/dialogs/document-move-to-folder-dialog';
import { CreateFolderDialog } from '~/components/dialogs/folder-create-dialog';
import { FolderDeleteDialog } from '~/components/dialogs/folder-delete-dialog';
import { FolderMoveDialog } from '~/components/dialogs/folder-move-dialog';
import { FolderRenameDialog } from '~/components/dialogs/folder-rename-dialog';
import { DocumentSearch } from '~/components/general/document/document-search';
import { DocumentStatus } from '~/components/general/document/document-status';
import { DocumentUploadDropzone } from '~/components/general/document/document-upload';
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
  folderId: z.string().optional(),
});

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<number | null>(null);
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);

  const team = useOptionalCurrentTeam();

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

  const currentFolderId = findDocumentSearchParams.folderId;

  const { data, isLoading, isLoadingError, refetch } = trpc.document.findDocumentsInternal.useQuery(
    {
      ...findDocumentSearchParams,
    },
  );

  const {
    data: foldersData,
    isLoading: isFoldersLoading,
    refetch: refetchFolders,
  } = trpc.folder.getFolders.useQuery({
    parentId: currentFolderId,
  });

  useEffect(() => {
    void refetch();
    void refetchFolders();
  }, [team?.url, currentFolderId, refetch, refetchFolders]);

  const getTabHref = (value: keyof typeof ExtendedDocumentStatus) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (value === ExtendedDocumentStatus.ALL) {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    return `${formatDocumentsPath(team?.url)}?${params.toString()}`;
  };

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  const navigateToFolder = (folderId?: string | null) => {
    const params = new URLSearchParams(searchParams);

    if (folderId) {
      params.set('folderId', folderId.toString());
    } else {
      params.delete('folderId');
    }

    setSearchParams(params);
  };

  const breadcrumbs = foldersData?.breadcrumbs || [];

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="flex flex-col gap-y-4 pb-8 sm:flex-row sm:gap-x-4">
        <DocumentUploadDropzone />
        <CreateFolderDialog />
      </div>

      <div className="mt-6 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-2 pl-0 hover:bg-transparent"
          onClick={() => navigateToFolder(null)}
        >
          <HomeIcon className="h-4 w-4" />
          <span>Home</span>
        </Button>

        {breadcrumbs.map((folder) => (
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
      {isFoldersLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {foldersData?.folders.map((folder) => (
            <div
              key={folder.id}
              className="border-border hover:border-muted-foreground/40 group relative flex flex-col rounded-lg border p-4 transition-all hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <button
                  className="flex items-center space-x-2 text-left"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  <FolderIcon className="h-6 w-6 text-blue-500" />
                  <div>
                    <h3 className="font-medium">{folder.name}</h3>
                    <div className="mt-1 flex space-x-2 text-xs text-gray-500">
                      <span>{folder._count.documents} documents</span>
                      <span>•</span>
                      <span>{folder._count.subfolders} folders</span>
                    </div>
                  </div>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                      •••
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setFolderToRename(folder);
                        setIsRenameFolderOpen(true);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setFolderToMove(folder);
                        setIsMovingFolder(true);
                      }}
                    >
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-500"
                      onClick={() => {
                        setFolderToDelete(folder);
                        setIsDeletingFolder(true);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-xs text-gray-400">
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
          currentFolderId={currentFolderId}
        />
      )}

      <FolderRenameDialog
        folder={folderToRename}
        isOpen={isRenameFolderOpen}
        onOpenChange={(open) => {
          setIsRenameFolderOpen(open);
          if (!open) {
            setFolderToRename(null);
          }
        }}
      />

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
  );
}
