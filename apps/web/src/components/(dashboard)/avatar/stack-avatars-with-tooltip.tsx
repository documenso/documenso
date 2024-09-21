'use client';

import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { DocumentStatus, Recipient } from '@documenso/prisma/client';
import { PopoverHover } from '@documenso/ui/primitives/popover';

import { AvatarWithRecipient } from './avatar-with-recipient';
import { StackAvatar } from './stack-avatar';
import { StackAvatars } from './stack-avatars';

export type StackAvatarsWithTooltipProps = {
  documentStatus: DocumentStatus;
  recipients: Recipient[];
  position?: 'top' | 'bottom';
  children?: React.ReactNode;
};

export const StackAvatarsWithTooltip = ({
  documentStatus,
  recipients,
  position,
  children,
}: StackAvatarsWithTooltipProps) => {
  const { _ } = useLingui();

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

  return (
    <PopoverHover
      trigger={children || <StackAvatars recipients={recipients.sort((a, b) => a.id - b.id)} />}
      contentProps={{
        className: 'flex flex-col gap-y-5 py-2',
        side: position,
      }}
    >
      {completedRecipients.length > 0 && (
        <div>
          <h1 className="text-base font-medium">
            <Trans>Completed</Trans>
          </h1>
          {completedRecipients.map((recipient: Recipient) => (
            <div key={recipient.id} className="my-1 flex items-center gap-2">
              <StackAvatar
                first={true}
                key={recipient.id}
                type={getRecipientType(recipient)}
                fallbackText={recipientAbbreviation(recipient)}
              />
              <div>
                <p className="text-muted-foreground text-sm">{recipient.email}</p>
                <p className="text-muted-foreground/70 text-xs">
                  {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {waitingRecipients.length > 0 && (
        <div>
          <h1 className="text-base font-medium">
            <Trans>Waiting</Trans>
          </h1>
          {waitingRecipients.map((recipient: Recipient) => (
            <AvatarWithRecipient
              key={recipient.id}
              recipient={recipient}
              documentStatus={documentStatus}
            />
          ))}
        </div>
      )}

      {openedRecipients.length > 0 && (
        <div>
          <h1 className="text-base font-medium">
            <Trans>Opened</Trans>
          </h1>
          {openedRecipients.map((recipient: Recipient) => (
            <AvatarWithRecipient
              key={recipient.id}
              recipient={recipient}
              documentStatus={documentStatus}
            />
          ))}
        </div>
      )}

      {uncompletedRecipients.length > 0 && (
        <div>
          <h1 className="text-base font-medium">
            <Trans>Uncompleted</Trans>
          </h1>
          {uncompletedRecipients.map((recipient: Recipient) => (
            <AvatarWithRecipient
              key={recipient.id}
              recipient={recipient}
              documentStatus={documentStatus}
            />
          ))}
        </div>
      )}
    </PopoverHover>
  );
};
