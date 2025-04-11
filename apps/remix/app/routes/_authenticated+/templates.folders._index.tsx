import { useState } from 'react';

import { HomeIcon, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Button } from '@documenso/ui/primitives/button';

import { TemplateFolderCreateDialog } from '~/components/dialogs/template-folder-create-dialog';
import { TemplateFolderDeleteDialog } from '~/components/dialogs/template-folder-delete-dialog';
import { TemplateFolderMoveDialog } from '~/components/dialogs/template-folder-move-dialog';
import { TemplateFolderSettingsDialog } from '~/components/dialogs/template-folder-settings-dialog';
import { FolderCard } from '~/components/general/folder/folder-card';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesFoldersPage() {
  const navigate = useNavigate();
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);

  const { data: foldersData, isLoading: isFoldersLoading } = trpc.folder.getFolders.useQuery({
    type: FolderType.TEMPLATE,
    parentId: null,
  });

  const { mutateAsync: pinFolder } = trpc.folder.pinFolder.useMutation();
  const { mutateAsync: unpinFolder } = trpc.folder.unpinFolder.useMutation();

  const navigateToFolder = (folderId?: string | null) => {
    const templatesPath = formatTemplatesPath();

    if (folderId) {
      void navigate(`${templatesPath}/f/${folderId}`);
    } else {
      void navigate(templatesPath);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="flex flex-col gap-y-4 pb-8 sm:flex-row sm:gap-x-4">
        <TemplateFolderCreateDialog />
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
      </div>

      {isFoldersLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {foldersData?.folders?.some((folder) => folder.pinned) && (
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
            <h3 className="text-muted-background/60 dark:text-muted-foreground/60 mb-4 text-sm font-medium">
              All Folders
            </h3>
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

      <TemplateFolderMoveDialog
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

      <TemplateFolderSettingsDialog
        folder={folderToSettings}
        isOpen={isSettingsFolderOpen}
        onOpenChange={(open: boolean) => {
          setIsSettingsFolderOpen(open);

          if (!open) {
            setFolderToSettings(null);
          }
        }}
      />

      <TemplateFolderDeleteDialog
        folder={folderToDelete}
        isOpen={isDeletingFolder}
        onOpenChange={(open: boolean) => {
          setIsDeletingFolder(open);

          if (!open) {
            setFolderToDelete(null);
          }
        }}
      />
    </div>
  );
}
