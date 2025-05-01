import { FolderIcon, PinIcon } from 'lucide-react';

import { FolderType } from '@documenso/lib/types/folder-type';
import { formatFolderCount } from '@documenso/lib/utils/format-folder-count';
import { type TFolderWithSubfolders } from '@documenso/trpc/server/folder-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

export type FolderCardProps = {
  folder: TFolderWithSubfolders;
  onNavigate: (folderId: string) => void;
  onMove: (folder: TFolderWithSubfolders) => void;
  onPin: (folderId: string) => void;
  onUnpin: (folderId: string) => void;
  onSettings: (folder: TFolderWithSubfolders) => void;
  onDelete: (folder: TFolderWithSubfolders) => void;
};

export const FolderCard = ({
  folder,
  onNavigate,
  onMove,
  onPin,
  onUnpin,
  onSettings,
  onDelete,
}: FolderCardProps) => {
  return (
    <div
      key={folder.id}
      className="border-border hover:border-muted-foreground/40 group relative flex flex-col rounded-lg border p-4 transition-all hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <button
          className="flex items-center space-x-2 text-left"
          onClick={() => onNavigate(folder.id)}
        >
          <FolderIcon className="text-documenso h-6 w-6" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{folder.name}</h3>
              {folder.pinned && <PinIcon className="text-documenso h-3 w-3" />}
            </div>
            <div className="mt-1 flex space-x-2 text-xs text-gray-500">
              <span>
                {formatFolderCount(
                  folder.type === FolderType.TEMPLATE
                    ? folder._count.templates
                    : folder._count.documents,
                  folder.type === FolderType.TEMPLATE ? 'template' : 'document',
                  folder.type === FolderType.TEMPLATE ? 'templates' : 'documents',
                )}
              </span>
              <span>•</span>
              <span>{formatFolderCount(folder._count.subfolders, 'folder', 'folders')}</span>
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
            <DropdownMenuItem onClick={() => onMove(folder)}>Move</DropdownMenuItem>
            {folder.pinned ? (
              <DropdownMenuItem onClick={() => onUnpin(folder.id)}>Unpin</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onPin(folder.id)}>Pin</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onSettings(folder)}>Settings</DropdownMenuItem>
            <DropdownMenuItem className="text-red-500" onClick={() => onDelete(folder)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
