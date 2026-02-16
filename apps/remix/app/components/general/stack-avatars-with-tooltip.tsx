import { useMemo } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { type DocumentStatus, type Recipient } from '@prisma/client';

import { RecipientStatusType, getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
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
    (recipient) => getRecipientType(recipient) === RecipientStatusType.WAITING,
  );

  const openedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === RecipientStatusType.OPENED,
  );

  const completedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === RecipientStatusType.COMPLETED,
  );

  const uncompletedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === RecipientStatusType.UNSIGNED,
  );

  const rejectedRecipients = recipients.filter(
    (recipient) => getRecipientType(recipient) === RecipientStatusType.REJECTED,
  );

  const sortedRecipients = useMemo(() => {
    const otherRecipients = recipients.filter(
      (recipient) => getRecipientType(recipient) !== RecipientStatusType.REJECTED,
    );

    return [
      ...rejectedRecipients.sort((a, b) => a.id - b.id),
      ...otherRecipients.sort((a, b) => {
        return a.id - b.id;
      }),
    ];
  }, [recipients]);

  return (
    <PopoverHover
      trigger={children || <StackAvatars recipients={sortedRecipients} />}
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
                <p className="text-sm text-muted-foreground">{recipient.email || recipient.name}</p>
                <p className="text-xs text-muted-foreground/70">
                  {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectedRecipients.length > 0 && (
        <div>
          <h1 className="text-base font-medium">
            <Trans>Rejected</Trans>
          </h1>
          {rejectedRecipients.map((recipient: Recipient) => (
            <div key={recipient.id} className="my-1 flex items-center gap-2">
              <StackAvatar
                first={true}
                key={recipient.id}
                type={getRecipientType(recipient)}
                fallbackText={recipientAbbreviation(recipient)}
              />
              <div>
                <p className="text-sm text-muted-foreground">{recipient.email || recipient.name}</p>
                <p className="text-xs text-muted-foreground/70">
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
