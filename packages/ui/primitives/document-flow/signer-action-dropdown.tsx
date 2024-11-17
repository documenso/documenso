'use client';

import { useState } from 'react';

import { MoreHorizontal, Timer, Trash } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';

import { cn } from '../../lib/utils';
import DocumentExpiryDialog from './document-expiry-dialog';

type SignerActionDropdownProps = {
  onDelete: () => void;
  deleteDisabled?: boolean;
  className?: string;
};

export function SignerActionDropdown({ deleteDisabled, className }: SignerActionDropdownProps) {
  const [isExpiryDialogOpen, setExpiryDialogOpen] = useState(false);

  return (
    <>
      <div className={cn('flex items-center justify-center', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreHorizontal className="text-muted-foreground h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-x-2" onClick={() => setExpiryDialogOpen(true)}>
                <Timer className="h-4 w-4" />
                Expiry
              </DropdownMenuItem>
              <DropdownMenuItem disabled={deleteDisabled} className="gap-x-2">
                <Trash className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <DocumentExpiryDialog open={isExpiryDialogOpen} onOpenChange={setExpiryDialogOpen} />
    </>
  );
}
