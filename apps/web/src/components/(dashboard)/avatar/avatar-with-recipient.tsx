'use client';

import React from 'react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { Recipient } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { StackAvatar } from './stack-avatar';

export type AvatarWithRecipientProps = {
  recipient: Recipient;
};

export function AvatarWithRecipient({ recipient }: AvatarWithRecipientProps) {
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

  const onRecipientClick = () => {
    if (!recipient.token) {
      return;
    }

    void copy(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The signing link has been copied to your clipboard.',
      });
    });
  };

  return (
    <div
      className={cn('my-1 flex items-center gap-2', {
        'cursor-pointer hover:underline': recipient.token,
      })}
      role={recipient.token ? 'button' : undefined}
      title={recipient.token && 'Click to copy signing link for sending to recipient'}
      onClick={onRecipientClick}
    >
      <StackAvatar
        first={true}
        key={recipient.id}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
      />
      <div>
        <div
          className="text-muted-foreground text-sm"
          title="Click to copy signing link for sending to recipient"
        >
          <p>{recipient.email} </p>
          <p className="text-muted-foreground/70 text-xs">
            {RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName}
          </p>
        </div>
      </div>
    </div>
  );
}
