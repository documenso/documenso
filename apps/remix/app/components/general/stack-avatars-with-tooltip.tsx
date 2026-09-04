import { getRecipientType, RecipientStatusType } from '@documenso/lib/client-only/recipient-type';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { cn } from '@documenso/ui/lib/utils';
import { PopoverHover } from '@documenso/ui/primitives/popover';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentStatus } from '@prisma/client';
import { useMemo } from 'react';

import { AvatarWithRecipient } from './avatar-with-recipient';
import { StackAvatar } from './stack-avatar';
import { StackAvatars } from './stack-avatars';

export type StackAvatarsWithTooltipProps = {
  documentStatus: DocumentStatus;
  recipients: TRecipientLite[];
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

  const openedRecipients = recipients.filter((recipient) => getRecipientType(recipient) === RecipientStatusType.OPENED);

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

  const sections = [
    {
      key: 'completed',
      label: <Trans>Completed</Trans>,
      dotClassName: 'bg-green-500',
      labelClassName: 'text-green-600 dark:text-green-400',
      recipients: completedRecipients,
      isInteractive: false,
    },
    {
      key: 'rejected',
      label: <Trans>Rejected</Trans>,
      dotClassName: 'bg-red-500',
      labelClassName: 'text-red-600 dark:text-red-400',
      recipients: rejectedRecipients,
      isInteractive: false,
    },
    {
      key: 'waiting',
      label: <Trans>Waiting</Trans>,
      dotClassName: 'bg-blue-500',
      labelClassName: 'text-blue-600 dark:text-blue-400',
      recipients: waitingRecipients,
      isInteractive: true,
    },
    {
      key: 'opened',
      label: <Trans>Opened</Trans>,
      dotClassName: 'bg-amber-400',
      labelClassName: 'text-amber-600 dark:text-amber-400',
      recipients: openedRecipients,
      isInteractive: true,
    },
    {
      key: 'uncompleted',
      label: <Trans>Uncompleted</Trans>,
      dotClassName: 'bg-gray-400',
      labelClassName: 'text-muted-foreground',
      recipients: uncompletedRecipients,
      isInteractive: true,
    },
  ].filter((section) => section.recipients.length > 0);

  return (
    <PopoverHover
      trigger={children || <StackAvatars recipients={sortedRecipients} />}
      contentProps={{
        className: 'w-64 divide-y divide-border/50 overflow-hidden p-0 text-sm',
        side: position,
      }}
    >
      {sections.map((section) => (
        <div key={section.key} className="px-3 pt-2.5 pb-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn('h-1.5 w-1.5 rounded-full', section.dotClassName)} />
            <span className={section.labelClassName}>{section.label}</span>
            <span className="text-muted-foreground">{section.recipients.length}</span>
          </div>

          <div className="mt-1.5">
            {section.isInteractive
              ? section.recipients.map((recipient) => (
                  <AvatarWithRecipient key={recipient.id} recipient={recipient} documentStatus={documentStatus} />
                ))
              : section.recipients.map((recipient) => (
                  <div key={recipient.id} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
                    <StackAvatar
                      first={true}
                      type={getRecipientType(recipient)}
                      fallbackText={recipientAbbreviation(recipient)}
                      className="h-8 w-8 shrink-0 border-0 text-xs"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{recipient.email || recipient.name}</p>
                      <p className="truncate text-muted-foreground text-xs">
                        {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
                      </p>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      ))}
    </PopoverHover>
  );
};
