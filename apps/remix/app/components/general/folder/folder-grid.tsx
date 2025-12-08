import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { FolderType } from '@prisma/client';
import { FolderIcon, HomeIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Skeleton } from '@documenso/ui/primitives/skeleton';

import { FolderCreateDialog } from '~/components/dialogs/folder-create-dialog';
import { FolderDeleteDialog } from '~/components/dialogs/folder-delete-dialog';
import { FolderMoveDialog } from '~/components/dialogs/folder-move-dialog';
import { FolderUpdateDialog } from '~/components/dialogs/folder-update-dialog';
import { TemplateCreateDialog } from '~/components/dialogs/template-create-dialog';
import { DocumentUploadButtonLegacy } from '~/components/general/document/document-upload-button-legacy';
import { FolderCard, FolderCardEmpty } from '~/components/general/folder/folder-card';
import { useCurrentTeam } from '~/providers/team';

import { EnvelopeUploadButton } from '../envelope/envelope-upload-button';

export type FolderGridProps = {
  type: FolderType;
  parentId: string | null;
};

export const FolderGrid = ({ type, parentId }: FolderGridProps) => {
  const team = useCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);

  const { data: foldersData, isPending } = trpc.folder.getFolders.useQuery({
    type,
    parentId,
  });

  const formatBreadCrumbPath = (folderId: string) => {
    const rootPath =
      type === FolderType.DOCUMENT ? formatDocumentsPath(team.url) : formatTemplatesPath(team.url);

    return `${rootPath}/f/${folderId}`;
  };

  const formatViewAllFoldersPath = () => {
    const rootPath =
      type === FolderType.DOCUMENT ? formatDocumentsPath(team.url) : formatTemplatesPath(team.url);

    return `${rootPath}/folders`;
  };

  const formatRootPath = () => {
    return type === FolderType.DOCUMENT
      ? formatDocumentsPath(team.url)
      : formatTemplatesPath(team.url);
  };

  const pinnedFolders = foldersData?.folders.filter((folder) => folder.pinned) || [];
  const unpinnedFolders = foldersData?.folders.filter((folder) => !folder.pinned) || [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div
          className="text-muted-foreground hover:text-muted-foreground/80 flex flex-1 items-center text-sm font-medium"
          data-testid="folder-grid-breadcrumbs"
        >
          <Link to={formatRootPath()} className="flex items-center">
            <HomeIcon className="mr-2 h-4 w-4" />
            <Trans>Home</Trans>
          </Link>

          {isPending && parentId ? (
            <div className="flex items-center">
              <Skeleton className="mx-3 h-4 w-1 rotate-12" />

              <Skeleton className="h-4 w-20" />
            </div>
          ) : (
            foldersData?.breadcrumbs.map((folder) => (
              <div key={folder.id} className="flex items-center">
                <span className="px-3">/</span>
                <Link to={formatBreadCrumbPath(folder.id)} className="flex items-center">
                  <FolderIcon className="mr-2 h-4 w-4" />
                  <span>{folder.name}</span>
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-4 sm:flex-row sm:justify-end">
          <EnvelopeUploadButton type={type} folderId={parentId || undefined} />

          {type === FolderType.DOCUMENT ? (
            <DocumentUploadButtonLegacy /> // If you delete this, delete the component as well.
          ) : (
            <TemplateCreateDialog folderId={parentId ?? undefined} /> // If you delete this, delete the component as well.
          )}

          <FolderCreateDialog type={type} />
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-border bg-card h-full rounded-lg border px-4 py-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex w-full items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <div className="flex space-x-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-2 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : foldersData && foldersData.folders.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <FolderCreateDialog
            type={type}
            trigger={
              <button>
                <FolderCardEmpty type={type} />
              </button>
            }
          />
        </div>
      ) : (
        foldersData && (
          <div key="content" className="space-y-4">
            {pinnedFolders.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {pinnedFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onMove={(folder) => {
                      setFolderToMove(folder);
                      setIsMovingFolder(true);
                    }}
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
            )}

            {unpinnedFolders.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {unpinnedFolders.slice(0, 12).map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onMove={(folder) => {
                      setFolderToMove(folder);
                      setIsMovingFolder(true);
                    }}
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
            )}

            {foldersData.folders.length > 12 && (
              <div className="mt-2 flex items-center justify-center">
                <Link
                  className="text-muted-foreground hover:text-foreground text-sm font-medium"
                  to={formatViewAllFoldersPath()}
                >
                  View all folders
                </Link>
              </div>
            )}
          </div>
        )
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

      <FolderUpdateDialog
        folder={folderToSettings}
        isOpen={isSettingsFolderOpen}
        onOpenChange={(open) => {
          setIsSettingsFolderOpen(open);

          if (!open) {
            setFolderToSettings(null);
          }
        }}
      />

      {folderToDelete && (
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
      )}
    </div>
  );
};
