import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { FolderIcon, HomeIcon, Loader2, SearchIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Input } from '@documenso/ui/primitives/input';

import { FolderCreateDialog } from '~/components/dialogs/folder-create-dialog';
import { FolderDeleteDialog } from '~/components/dialogs/folder-delete-dialog';
import { FolderMoveDialog } from '~/components/dialogs/folder-move-dialog';
import { FolderUpdateDialog } from '~/components/dialogs/folder-update-dialog';
import { FolderCard } from '~/components/general/folder/folder-card';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Documents');
}

export default function DocumentsFoldersPage() {
  const { t } = useLingui();

  const team = useCurrentTeam();
  const [searchParams] = useSearchParams();

  const parentId = searchParams.get('parentId');

  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: foldersData, isLoading: isFoldersLoading } = trpc.folder.getFolders.useQuery({
    type: FolderType.DOCUMENT,
    parentId: parentId,
  });

  const isFolderMatchingSearch = (folder: TFolderWithSubfolders) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase());

  const formatBreadCrumbPath = (folderId: string) => {
    const documentsPath = formatDocumentsPath(team.url);

    return `${documentsPath}/f/${folderId}`;
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-1 items-center text-sm font-medium text-muted-foreground">
          <Link
            to={formatDocumentsPath(team.url)}
            className="flex items-center hover:text-muted-foreground/80"
          >
            <HomeIcon className="mr-2 h-4 w-4" />
            <Trans>Home</Trans>
          </Link>

          {foldersData?.breadcrumbs.map((folder) => (
            <div key={folder.id} className="flex items-center">
              <span className="px-3">/</span>
              <Link
                to={formatBreadCrumbPath(folder.id)}
                className="flex items-center hover:text-muted-foreground/80"
              >
                <FolderIcon className="mr-2 h-4 w-4" />
                <span>{folder.name}</span>
              </Link>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-y-4 sm:flex-row sm:justify-end sm:gap-x-4">
          <FolderCreateDialog type={FolderType.DOCUMENT} parentFolderId={parentId} />
        </div>
      </div>

      <div className="relative w-full max-w-md py-6">
        <SearchIcon className="absolute left-2 top-9 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t`Search folders...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl">
        <Trans>All Folders</Trans>
      </h1>

      {isFoldersLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {foldersData?.folders?.some(
            (folder) => folder.pinned && isFolderMatchingSearch(folder),
          ) && (
            <div className="mt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {foldersData.folders
                  .filter((folder) => folder.pinned && isFolderMatchingSearch(folder))
                  .map((folder) => (
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
            </div>
          )}

          <div>
            {searchTerm && foldersData?.folders.filter(isFolderMatchingSearch).length === 0 && (
              <div className="mt-6 text-center text-muted-foreground">
                <Trans>No folders found matching "{searchTerm}"</Trans>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {foldersData?.folders
                .filter((folder) => !folder.pinned && isFolderMatchingSearch(folder))
                .map((folder) => (
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
          </div>
        </>
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
}
