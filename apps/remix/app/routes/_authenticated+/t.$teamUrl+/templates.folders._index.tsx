import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { HomeIcon, Loader2, SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';

import { FolderCreateDialog } from '~/components/dialogs/folder-create-dialog';
import { FolderDeleteDialog } from '~/components/dialogs/folder-delete-dialog';
import { FolderMoveDialog } from '~/components/dialogs/folder-move-dialog';
import { FolderUpdateDialog } from '~/components/dialogs/folder-update-dialog';
import { FolderCard } from '~/components/general/folder/folder-card';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesFoldersPage() {
  const { t } = useLingui();

  const navigate = useNavigate();
  const team = useCurrentTeam();

  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: foldersData, isLoading: isFoldersLoading } = trpc.folder.getFolders.useQuery({
    type: FolderType.TEMPLATE,
    parentId: null,
  });

  const navigateToFolder = (folderId?: string | null) => {
    const templatesPath = formatTemplatesPath(team.url);

    if (folderId) {
      void navigate(`${templatesPath}/f/${folderId}`);
    } else {
      void navigate(templatesPath);
    }
  };

  const isFolderMatchingSearch = (folder: TFolderWithSubfolders) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase());

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="flex w-full items-center justify-between">
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
        </div>

        <div className="flex flex-col gap-y-4 sm:flex-row sm:justify-end sm:gap-x-4">
          <FolderCreateDialog type={FolderType.TEMPLATE} />
        </div>
      </div>

      <div className="relative w-full max-w-md py-6">
        <SearchIcon className="text-muted-foreground absolute left-2 top-9 h-4 w-4" />
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
        <div className="mt- flex justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
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
              <div className="text-muted-foreground mt-6 text-center">
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
        onOpenChange={(open: boolean) => {
          setIsMovingFolder(open);

          if (!open) {
            setFolderToMove(null);
          }
        }}
      />

      <FolderUpdateDialog
        folder={folderToSettings}
        isOpen={isSettingsFolderOpen}
        onOpenChange={(open: boolean) => {
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
          onOpenChange={(open: boolean) => {
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
