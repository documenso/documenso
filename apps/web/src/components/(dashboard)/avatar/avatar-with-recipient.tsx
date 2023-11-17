'use client';

import React from 'react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { Recipient } from '@documenso/prisma/client';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { StackAvatar } from './stack-avatar';

export type AvatarWithRecipientProps = {
  recipient: Recipient;
};

export function AvatarWithRecipient({ recipient }: AvatarWithRecipientProps) {
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

  const onRecipientClick = () => {
    void copy(`${process.env.NEXT_PUBLIC_WEBAPP_URL}/sign/${recipient.token}`).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The signing link has been copied to your clipboard.',
      });
    });
  };

  return (
    <div className="my-1 flex cursor-pointer items-center gap-2" onClick={onRecipientClick}>
      <StackAvatar
        first={true}
        key={recipient.id}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
      />
      <span
        className="text-muted-foreground text-sm hover:underline"
        title="Click to copy signing link for sending to recipient"
      >
        {recipient.email}
      </span>
    </div>
  );
}
