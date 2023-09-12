import React from 'react';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { Recipient } from '@documenso/prisma/client';

import { StackAvatar } from './stack-avatar';

export function StackAvatars({ recipients }: { recipients: Recipient[] }) {
  const renderStackAvatars = (recipients: Recipient[]) => {
    const zIndex = 50;
    const itemsToRender = recipients.slice(0, 5);
    const remainingItems = recipients.length - itemsToRender.length;

    return itemsToRender.map((recipient: Recipient, index: number) => {
      const first = index === 0 ? true : false;

      const lastItemText =
        index === itemsToRender.length - 1 && remainingItems > 0
          ? `+${remainingItems + 1}`
          : undefined;

      return (
        <StackAvatar
          key={recipient.id}
          first={first}
          zIndex={String(zIndex - index * 10)}
          type={lastItemText && index === 4 ? 'unsigned' : getRecipientType(recipient)}
          fallbackText={lastItemText ? lastItemText : recipientAbbreviation(recipient)}
        />
      );
    });
  };

  return <>{renderStackAvatars(recipients)}</>;
}
