import React from 'react';

import type { Recipient } from '@prisma/client';

import {
  getExtraRecipientsType,
  getRecipientType,
} from '@documenso/lib/client-only/recipient-type';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';

import { StackAvatar } from './stack-avatar';

export function StackAvatars({ recipients }: { recipients: Recipient[] }) {
  const renderStackAvatars = (recipients: Recipient[]) => {
    const zIndex = 50;
    const itemsToRender = recipients.slice(0, 5);
    const remainingItems = recipients.length - itemsToRender.length;

    return itemsToRender.map((recipient: Recipient, index: number) => {
      const first = index === 0;

      if (index === 4 && remainingItems > 0) {
        return (
          <StackAvatar
            key="extra-recipient"
            first={first}
            zIndex={String(zIndex - index * 10)}
            type={getExtraRecipientsType(recipients.slice(4))}
            fallbackText={`+${remainingItems + 1}`}
          />
        );
      }

      return (
        <StackAvatar
          key={recipient.id}
          first={first}
          zIndex={String(zIndex - index * 10)}
          type={getRecipientType(recipient)}
          fallbackText={recipientAbbreviation(recipient)}
        />
      );
    });
  };

  return <>{renderStackAvatars(recipients)}</>;
}
