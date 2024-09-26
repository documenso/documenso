'use client';

import React from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { Recipient } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { StackAvatar } from './stack-avatar';

export type AvatarWithRecipientProps = {
  recipient: Recipient;
  documentStatus: DocumentStatus;
};

export function AvatarWithRecipient({ recipient, documentStatus }: AvatarWithRecipientProps) {
  const [, copy] = useCopyToClipboard();

  const { _ } = useLingui();
  const { toast } = useToast();

  const signingToken = documentStatus === DocumentStatus.PENDING ? recipient.token : null;

  const onRecipientClick = () => {
    if (!signingToken) {
      return;
    }

    void copy(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${signingToken}`).then(() => {
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The signing link has been copied to your clipboard.`),
      });
    });
  };

  return (
    <div
      className={cn('my-1 flex items-center gap-2', {
        'cursor-pointer hover:underline': signingToken,
      })}
      role={signingToken ? 'button' : undefined}
      title={signingToken ? _(msg`Click to copy signing link for sending to recipient`) : undefined}
      onClick={onRecipientClick}
    >
      <StackAvatar
        first={true}
        key={recipient.id}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
      />

      <div
        className="text-muted-foreground text-sm"
        title={
          signingToken ? _(msg`Click to copy signing link for sending to recipient`) : undefined
        }
      >
        <p>{recipient.email}</p>
        <p className="text-muted-foreground/70 text-xs">
          {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
        </p>
      </div>
    </div>
  );
}
