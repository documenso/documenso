import { initials } from '@documenso/lib/client-only/recipient-initials';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { Recipient } from '@documenso/prisma/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import { StackAvatar } from './stack-avatar';
import { StackAvatars } from './stack-avatars';

export const StackAvatarsWithTooltip = ({ recipients }: { recipients: Recipient[] }) => {
  const waitingRecipients = recipients.filter(
    (recipient) => recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED',
  );

  const completedRecipients = recipients.filter(
    (recipient) => recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED',
  );

  const uncompletedRecipients = recipients.filter(
    (recipient) => recipient.sendStatus === 'NOT_SENT' && recipient.signingStatus === 'NOT_SIGNED',
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex cursor-pointer">
          <StackAvatars recipients={recipients} />
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-y-5 p-1">
            {completedRecipients.length > 0 && (
              <div>
                <h1 className="text-base font-medium">Completed</h1>
                {completedRecipients.map((recipient: Recipient) => (
                  <div key={recipient.id} className="my-1 flex items-center gap-2">
                    <StackAvatar
                      first={true}
                      key={recipient.id}
                      type={getRecipientType(recipient)}
                      fallbackText={initials(recipient.name)}
                    />
                    <span className="text-sm text-gray-500">{recipient.email}</span>
                  </div>
                ))}
              </div>
            )}

            {waitingRecipients.length > 0 && (
              <div>
                <h1 className="text-base font-medium">Waiting</h1>
                {waitingRecipients.map((recipient: Recipient) => (
                  <div key={recipient.id} className="my-1 flex items-center gap-2">
                    <StackAvatar
                      first={true}
                      key={recipient.id}
                      type={getRecipientType(recipient)}
                      fallbackText={initials(recipient.name)}
                    />
                    <span className="text-sm text-gray-500">{recipient.email}</span>
                  </div>
                ))}
              </div>
            )}

            {uncompletedRecipients.length > 0 && (
              <div>
                <h1 className="text-base font-medium">Uncompleted</h1>
                {uncompletedRecipients.map((recipient: Recipient) => (
                  <div key={recipient.id} className="my-1 flex items-center gap-2">
                    <StackAvatar
                      first={true}
                      key={recipient.id}
                      type={getRecipientType(recipient)}
                      fallbackText={initials(recipient.name)}
                    />
                    <span className="text-sm text-gray-500">{recipient.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
