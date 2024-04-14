'use client';

import { useRef, useState } from 'react';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { Recipient } from '@documenso/prisma/client';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import { AvatarWithRecipient } from './avatar-with-recipient';
import { StackAvatar } from './stack-avatar';
import { StackAvatars } from './stack-avatars';

export type StackAvatarsWithTooltipProps = {
  recipients: Recipient[];
  position?: 'top' | 'bottom';
  children?: React.ReactNode;
};

export const StackAvatarsWithTooltip = ({
  recipients,
  position,
  children,
}: StackAvatarsWithTooltipProps) => {
  const [open, setOpen] = useState(false);

  const isControlled = useRef(false);
  const isMouseOverTimeout = useRef<NodeJS.Timeout | null>(null);

  const waitingRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === 'waiting',
  );

  const openedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === 'opened',
  );

  const completedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === 'completed',
  );

  const uncompletedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === 'unsigned',
  );

  const onMouseEnter = () => {
    if (isMouseOverTimeout.current) {
      clearTimeout(isMouseOverTimeout.current);
    }

    if (isControlled.current) {
      return;
    }

    isMouseOverTimeout.current = setTimeout(() => {
      setOpen((o) => (!o ? true : o));
    }, 200);
  };

  const onMouseLeave = () => {
    if (isMouseOverTimeout.current) {
      clearTimeout(isMouseOverTimeout.current);
    }

    if (isControlled.current) {
      return;
    }

    setTimeout(() => {
      setOpen((o) => (o ? false : o));
    }, 200);
  };

  const onOpenChange = (newOpen: boolean) => {
    isControlled.current = newOpen;

    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className="flex cursor-pointer"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children || <StackAvatars recipients={recipients} />}
      </PopoverTrigger>

      <PopoverContent
        side={position}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="flex flex-col gap-y-5 py-2"
      >
        {completedRecipients.length > 0 && (
          <div>
            <h1 className="text-base font-medium">Completed</h1>
            {completedRecipients.map((recipient: Recipient) => (
              <div key={recipient.id} className="my-1 flex items-center gap-2">
                <StackAvatar
                  first={true}
                  key={recipient.id}
                  type={getRecipientType(recipient)}
                  fallbackText={recipientAbbreviation(recipient)}
                />
                <div className="">
                  <p className="text-muted-foreground text-sm">{recipient.email}</p>
                  <p className="text-muted-foreground/70 text-xs">
                    {RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {waitingRecipients.length > 0 && (
          <div>
            <h1 className="text-base font-medium">Waiting</h1>
            {waitingRecipients.map((recipient: Recipient) => (
              <AvatarWithRecipient key={recipient.id} recipient={recipient} />
            ))}
          </div>
        )}

        {openedRecipients.length > 0 && (
          <div>
            <h1 className="text-base font-medium">Opened</h1>
            {openedRecipients.map((recipient: Recipient) => (
              <AvatarWithRecipient key={recipient.id} recipient={recipient} />
            ))}
          </div>
        )}

        {uncompletedRecipients.length > 0 && (
          <div>
            <h1 className="text-base font-medium">Uncompleted</h1>
            {uncompletedRecipients.map((recipient: Recipient) => (
              <AvatarWithRecipient key={recipient.id} recipient={recipient} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
