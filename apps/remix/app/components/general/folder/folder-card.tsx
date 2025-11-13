import { Plural, Trans } from '@lingui/react/macro';
import { FolderType } from '@prisma/client';
import {
  ArrowRightIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreVerticalIcon,
  PinIcon,
  SettingsIcon,
  TrashIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import { formatDocumentsPath, formatTemplatesPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { useCurrentTeam } from '~/providers/team';

export type FolderCardProps = {
  folder: TFolderWithSubfolders;
  onMove: (folder: TFolderWithSubfolders) => void;
  onSettings: (folder: TFolderWithSubfolders) => void;
  onDelete: (folder: TFolderWithSubfolders) => void;
};

export const FolderCard = ({ folder, onMove, onSettings, onDelete }: FolderCardProps) => {
  const team = useCurrentTeam();

  const { mutateAsync: updateFolderMutation } = trpc.folder.updateFolder.useMutation();

  const formatPath = () => {
    const rootPath =
      folder.type === FolderType.DOCUMENT
        ? formatDocumentsPath(team.url)
        : formatTemplatesPath(team.url);

    return `${rootPath}/f/${folder.id}`;
  };

  const updateFolder = async ({ pinned }: { pinned: boolean }) => {
    await updateFolderMutation({
      folderId: folder.id,
      data: {
        pinned,
      },
    });
  };

  return (
    <Link to={formatPath()} data-folder-id={folder.id} data-folder-name={folder.name}>
      <Card className="hover:bg-muted/50 border-border h-full border transition-all">
        <CardContent className="p-4">
          <div className="flex min-w-0 items-center gap-3">
            <FolderIcon className="text-documenso h-6 w-6 flex-shrink-0" />

            <div className="flex w-full min-w-0 items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="truncate">{folder.name}</span>
                  {folder.pinned && <PinIcon className="text-documenso h-3 w-3 flex-shrink-0" />}
                </h3>

                <div className="text-muted-foreground mt-1 flex space-x-2 truncate text-xs">
                  <span>
                    {folder.type === FolderType.TEMPLATE ? (
                      <Plural
                        value={folder._count.templates}
                        one={<Trans># template</Trans>}
                        other={<Trans># templates</Trans>}
                      />
                    ) : (
                      <Plural
                        value={folder._count.documents}
                        one={<Trans># document</Trans>}
                        other={<Trans># documents</Trans>}
                      />
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    <Plural
                      value={folder._count.subfolders}
                      one={<Trans># folder</Trans>}
                      other={<Trans># folders</Trans>}
                    />
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    data-testid="folder-card-more-button"
                  >
                    <MoreVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="end">
                  <DropdownMenuItem onClick={() => onMove(folder)}>
                    <ArrowRightIcon className="mr-2 h-4 w-4" />
                    <Trans>Move</Trans>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={async () => updateFolder({ pinned: !folder.pinned })}>
                    <PinIcon className="mr-2 h-4 w-4" />
                    {folder.pinned ? <Trans>Unpin</Trans> : <Trans>Pin</Trans>}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => onSettings(folder)}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <Trans>Settings</Trans>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => onDelete(folder)}>
                    <TrashIcon className="mr-2 h-4 w-4" />
                    <Trans>Delete</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export const FolderCardEmpty = ({ type }: { type: FolderType }) => {
  return (
    <Card className="hover:bg-muted/50 border-border h-full border transition-all">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <FolderPlusIcon className="text-muted-foreground/60 h-6 w-6" />

          <div>
            <h3 className="text-muted-foreground flex items-center gap-2 font-medium">
              <Trans>Create folder</Trans>
            </h3>

            <div className="text-muted-foreground/60 mt-1 flex space-x-2 truncate text-xs">
              {type === FolderType.DOCUMENT ? (
                <Trans>Organise your documents</Trans>
              ) : (
                <Trans>Organise your templates</Trans>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
