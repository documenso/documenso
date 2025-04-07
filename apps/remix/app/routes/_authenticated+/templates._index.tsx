import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Bird, FolderIcon, HomeIcon, Loader2, PinIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { TemplateCreateDialog } from '~/components/dialogs/template-create-dialog';
import { TemplateFolderCreateDialog } from '~/components/dialogs/template-folder-create-dialog';
import { TemplateFolderDeleteDialog } from '~/components/dialogs/template-folder-delete-dialog';
import { TemplateFolderMoveDialog } from '~/components/dialogs/template-folder-move-dialog';
import { TemplateFolderSettingsDialog } from '~/components/dialogs/template-folder-settings-dialog';
import { TemplatesTable } from '~/components/tables/templates-table';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Templates');
}

export default function TemplatesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [folderToMove, setFolderToMove] = useState<TFolderWithSubfolders | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<TFolderWithSubfolders | null>(null);
  const [isSettingsFolderOpen, setIsSettingsFolderOpen] = useState(false);
  const [folderToSettings, setFolderToSettings] = useState<TFolderWithSubfolders | null>(null);

  const team = useOptionalCurrentTeam();

  const utils = trpc.useUtils();

  const pinFolder = trpc.folder.pinFolder.useMutation({
    onSuccess: () => {
      void utils.folder.getFolders.invalidate();
    },
  });

  const unpinFolder = trpc.folder.unpinFolder.useMutation({
    onSuccess: () => {
      void utils.folder.getFolders.invalidate();
    },
  });

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
    parentId: null,
    type: FolderType.TEMPLATE,
  });

  useEffect(() => {
    void refetch();
    void refetchFolders();
  }, [team?.url, refetch, refetchFolders]);

  const navigateToFolder = (folderId?: string | null) => {
    const templatesPath = formatTemplatesPath(team?.url);
    if (folderId) {
      void navigate(`${templatesPath}/f/${folderId}`);
    } else {
      void navigate(templatesPath);
    }
  };

  const breadcrumbs = foldersData?.breadcrumbs || [];

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-xs text-gray-400">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          )}

          <h1 className="truncate text-2xl font-semibold md:text-3xl">
            <Trans>Templates</Trans>
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <TemplateFolderCreateDialog />
          <TemplateCreateDialog templateRootPath={templateRootPath} />
        </div>
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
        <>
          {foldersData?.folders && foldersData.folders.some((folder) => folder.pinned) && (
            <div className="mt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {foldersData.folders
                  .filter((folder) => folder.pinned)
                  .map((folder) => (
                    <div
                      key={folder.id}
                      className="border-border hover:border-muted-foreground/40 group relative flex flex-col rounded-lg border p-4 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <button
                          className="flex items-center space-x-2 text-left"
                          onClick={() => navigateToFolder(folder.id)}
                        >
                          <FolderIcon className="text-documenso h-6 w-6" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{folder.name}</h3>
                              <PinIcon className="text-documenso h-3 w-3" />
                            </div>
                            <div className="mt-1 flex space-x-2 text-xs text-gray-500">
                              <span>{folder._count.documents || 0} templates</span>
                              <span>•</span>
                              <span>{folder._count.subfolders || 0} folders</span>
                            </div>
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              •••
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setFolderToMove(folder);
                                setIsMovingFolder(true);
                              }}
                            >
                              Move
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                void unpinFolder.mutateAsync({ folderId: folder.id });
                              }}
                            >
                              Unpin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setFolderToSettings(folder);
                                setIsSettingsFolderOpen(true);
                              }}
                            >
                              Settings
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
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-muted-background/60 dark:text-muted-foreground/60 mb-4 text-sm font-medium">
              Folders
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {foldersData?.folders
                .filter((folder) => !folder.pinned)
                .map((folder) => (
                  <div
                    key={folder.id}
                    className="border-border hover:border-muted-foreground/40 group relative flex flex-col rounded-lg border p-4 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <button
                        className="flex items-center space-x-2 text-left"
                        onClick={() => navigateToFolder(folder.id)}
                      >
                        <FolderIcon className="text-documenso h-6 w-6" />
                        <div>
                          <h3 className="font-medium">{folder.name}</h3>
                          <div className="mt-1 flex space-x-2 text-xs text-gray-500">
                            <span>{folder._count.documents || 0} templates</span>
                            <span>•</span>
                            <span>{folder._count.subfolders || 0} folders</span>
                          </div>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setFolderToMove(folder);
                              setIsMovingFolder(true);
                            }}
                          >
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              void pinFolder.mutateAsync({ folderId: folder.id });
                            }}
                          >
                            Pin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setFolderToSettings(folder);
                              setIsSettingsFolderOpen(true);
                            }}
                          >
                            Settings
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
          </div>
        </>
      )}

      <div className="mt-12">
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
