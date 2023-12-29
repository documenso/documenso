'use client';

import { useWindowSize } from '@documenso/lib/client-only/hooks/use-window-size';
import type { Recipient } from '@documenso/prisma/client';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import { StackAvatars } from './stack-avatars';
import { StackAvatarsComponent } from './stack-avatars-component';

export type StackAvatarsUIProps = {
  recipients: Recipient[];
  position?: 'top' | 'bottom';
  children?: React.ReactNode;
};

export const StackAvatarsUI = ({ recipients, position, children }: StackAvatarsUIProps) => {
  const size = useWindowSize();

  return (
    <>
      {size.width > 1050 ? (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger className="flex cursor-pointer">
              {children || <StackAvatars recipients={recipients} />}
            </TooltipTrigger>

            <TooltipContent side={position}>
              <StackAvatarsComponent recipients={recipients} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Popover>
          <PopoverTrigger className="flex cursor-pointer">
            {children || <StackAvatars recipients={recipients} />}
          </PopoverTrigger>

          <PopoverContent side={position}>
            <StackAvatarsComponent recipients={recipients} />
          </PopoverContent>
        </Popover>
      )}
    </>
  );
};
