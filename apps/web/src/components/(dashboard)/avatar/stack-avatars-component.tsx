import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import type { Recipient } from '@documenso/prisma/client';

import { AvatarWithRecipient } from './avatar-with-recipient';
import { StackAvatar } from './stack-avatar';

export const StackAvatarsComponent = ({ recipients }: { recipients: Recipient[] }) => {
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
    <div className="flex flex-col gap-y-5 px-1">
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
              <span className="text-muted-foreground text-sm">{recipient.email}</span>
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
    </div>
  );
};
