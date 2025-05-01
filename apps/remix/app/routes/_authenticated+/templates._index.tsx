import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Bird, FolderIcon, HomeIcon, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';

import { TemplateCreateDialog } from '~/components/dialogs/template-create-dialog';
import { TemplateFolderCreateDialog } from '~/components/dialogs/template-folder-create-dialog';
import { TemplateFolderDeleteDialog } from '~/components/dialogs/template-folder-delete-dialog';
import { TemplateFolderMoveDialog } from '~/components/dialogs/template-folder-move-dialog';
import { TemplateFolderSettingsDialog } from '~/components/dialogs/template-folder-settings-dialog';
import { FolderCard } from '~/components/general/folder/folder-card';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);

  const team = useOptionalCurrentTeam();

  const { mutateAsync: pinFolder } = trpc.folder.pinFolder.useMutation();
  const { mutateAsync: unpinFolder } = trpc.folder.unpinFolder.useMutation();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;

  const documentRootPath = formatDocumentsPath(team?.url);
  const templateRootPath = formatTemplatesPath(team?.url);

  const { data, isLoading, isLoadingError, refetch } = trpc.template.findTemplates.useQuery({
    page: page,
    perPage: perPage,
  });

  const {
    data: foldersData,
    isLoading: isFoldersLoading,
    refetch: refetchFolders,
  } = trpc.folder.getFolders.useQuery({
    type: FolderType.TEMPLATE,
    parentId: null,
  });

  useEffect(() => {
    void refetch();
    void refetchFolders();
  }, [team?.url]);

  const navigateToFolder = (folderId?: string | null) => {
    const templatesPath = formatTemplatesPath(team?.url);

    if (folderId) {
      void navigate(`${templatesPath}/f/${folderId}`);
    } else {
      void navigate(templatesPath);
    }
  };

  const handleNavigate = (folderId: string) => {
    navigateToFolder(folderId);
  };

  const handleMove = (folder: TFolderWithSubfolders) => {
    setFolderToMove(folder);
    setIsMovingFolder(true);
  };

  const handlePin = (folderId: string) => {
    void pinFolder({ folderId });
  };

  const handleUnpin = (folderId: string) => {
    void unpinFolder({ folderId });
  };

  const handleSettings = (folder: TFolderWithSubfolders) => {
    setFolderToSettings(folder);
    setIsSettingsFolderOpen(true);
  };

  const handleDelete = (folder: TFolderWithSubfolders) => {
    setFolderToDelete(folder);
    setIsDeletingFolder(true);
  };

  const handleViewAllFolders = () => {
    void navigate(`${formatTemplatesPath(team?.url)}/folders`);
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
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
          <TemplateCreateDialog templateRootPath={templateRootPath} />
          <TemplateFolderCreateDialog />
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
                      onNavigate={handleNavigate}
                      onMove={handleMove}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                      onSettings={handleSettings}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {foldersData?.folders
                ?.filter((folder) => !folder.pinned)
                .slice(0, 12)
                .map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onNavigate={handleNavigate}
                    onMove={handleMove}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onSettings={handleSettings}
                    onDelete={handleDelete}
                  />
                ))}
            </div>

            <div className="mt-6 flex items-center justify-center">
              {foldersData && foldersData.folders?.length > 12 && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void handleViewAllFolders()}
                >
                  View all folders
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-12">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-muted-foreground text-xs">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          )}

          <h1 className="truncate text-2xl font-semibold md:text-3xl">
            <Trans>Templates</Trans>
          </h1>
        </div>

        <div className="mt-8">
          {data && data.count === 0 ? (
            <div className="text-muted-foreground/60 flex h-96 flex-col items-center justify-center gap-y-4">
              <Bird className="h-12 w-12" strokeWidth={1.5} />

              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  <Trans>We're all empty</Trans>
                </h3>

                <p className="mt-2 max-w-[50ch]">
                  <Trans>
                    You have not yet created any templates. To create a template please upload one.
                  </Trans>
                </p>
              </div>
            </div>
          ) : (
            <TemplatesTable
              data={data}
              isLoading={isLoading}
              isLoadingError={isLoadingError}
              documentRootPath={documentRootPath}
              templateRootPath={templateRootPath}
            />
          )}
        </div>
      </div>

      <TemplateFolderMoveDialog
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

      <TemplateFolderSettingsDialog
        folder={folderToSettings}
        isOpen={isSettingsFolderOpen}
        onOpenChange={(open) => {
          setIsSettingsFolderOpen(open);

          if (!open) {
            setFolderToSettings(null);
          }
        }}
      />

      <TemplateFolderDeleteDialog
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
