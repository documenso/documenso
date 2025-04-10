import { useCallback, useState } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { RecipientRole, SendStatus } from '@prisma/client';
import { Check, ChevronsUpDown, Info } from 'lucide-react';
import { sortBy } from 'remeda';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

import { getSignerColorStyles } from '../lib/signer-colors';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export interface RecipientSelectorProps {
  className?: string;
  selectedRecipient: Recipient | null;
  onSelectedRecipientChange: (recipient: Recipient) => void;
  recipients: Recipient[];
}

export const RecipientSelector = ({
  className,
  selectedRecipient,
  onSelectedRecipientChange,
  recipients,
}: RecipientSelectorProps) => {
  const { _ } = useLingui();
  const [showRecipientsSelector, setShowRecipientsSelector] = useState(false);

  const recipientsByRole = useCallback(() => {
    const recipientsByRole: Record<RecipientRole, Recipient[]> = {
      CC: [],
      VIEWER: [],
      SIGNER: [],
      APPROVER: [],
      ASSISTANT: [],
    };

    recipients.forEach((recipient) => {
      recipientsByRole[recipient.role].push(recipient);
    });

    return recipientsByRole;
  }, [recipients]);

  const recipientsByRoleToDisplay = useCallback(() => {
    return Object.entries(recipientsByRole())
      .filter(
        ([role]) =>
          role !== RecipientRole.CC &&
          role !== RecipientRole.VIEWER &&
          role !== RecipientRole.ASSISTANT,
      )
      .map(
        ([role, roleRecipients]) =>
          [
            role,
            sortBy(
              roleRecipients,
              [(r) => r.signingOrder || Number.MAX_SAFE_INTEGER, 'asc'],
              [(r) => r.id, 'asc'],
            ),
          ] as [RecipientRole, Recipient[]],
      );
  }, [recipientsByRole]);

  return (
    <Popover open={showRecipientsSelector} onOpenChange={setShowRecipientsSelector}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'bg-background text-muted-foreground hover:text-foreground justify-between font-normal',
            getSignerColorStyles(
              Math.max(
                recipients.findIndex((r) => r.id === selectedRecipient?.id),
                0,
              ),
            ).default.base,
            className,
          )}
        >
          {selectedRecipient?.email && (
            <span className="flex-1 truncate text-left">
              {selectedRecipient?.name} ({selectedRecipient?.email})
            </span>
          )}

          {!selectedRecipient?.email && (
            <span className="flex-1 truncate text-left">{selectedRecipient?.email}</span>
          )}

          <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0" align="start">
        <Command value={selectedRecipient?.email}>
          <CommandInput />

          <CommandEmpty>
            <span className="text-muted-foreground inline-block px-4">
              <Trans>No recipient matching this description was found.</Trans>
            </span>
          </CommandEmpty>

          {recipientsByRoleToDisplay().map(([role, roleRecipients], roleIndex) => (
            <CommandGroup key={roleIndex}>
              <div className="text-muted-foreground mb-1 ml-2 mt-2 text-xs font-medium">
                {_(RECIPIENT_ROLES_DESCRIPTION[role].roleNamePlural)}
              </div>

              {roleRecipients.length === 0 && (
                <div
                  key={`${role}-empty`}
                  className="text-muted-foreground/80 px-4 pb-4 pt-2.5 text-center text-xs"
                >
                  <Trans>No recipients with this role</Trans>
                </div>
              )}

              {roleRecipients.map((recipient) => (
                <CommandItem
                  key={recipient.id}
                  className={cn(
                    'px-2 last:mb-1 [&:not(:first-child)]:mt-1',
                    getSignerColorStyles(
                      Math.max(
                        recipients.findIndex((r) => r.id === recipient.id),
                        0,
                      ),
                    ).default.comboxBoxItem,
                    {
                      'text-muted-foreground': recipient.sendStatus === SendStatus.SENT,
                    },
                  )}
                  onSelect={() => {
                    onSelectedRecipientChange(recipient);
                    setShowRecipientsSelector(false);
                  }}
                >
                  <span
                    className={cn('text-foreground/70 truncate', {
                      'text-foreground/80': recipient === selectedRecipient,
                    })}
                  >
                    {recipient.name && (
                      <span title={`${recipient.name} (${recipient.email})`}>
                        {recipient.name} ({recipient.email})
                      </span>
                    )}

                    {!recipient.name && <span title={recipient.email}>{recipient.email}</span>}
                  </span>

                  <div className="ml-auto flex items-center justify-center">
                    {recipient.sendStatus !== SendStatus.SENT ? (
                      <Check
                        aria-hidden={recipient !== selectedRecipient}
                        className={cn('h-4 w-4 flex-shrink-0', {
                          'opacity-0': recipient !== selectedRecipient,
                          'opacity-100': recipient === selectedRecipient,
                        })}
                      />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="ml-2 h-4 w-4" />
                        </TooltipTrigger>

                        <TooltipContent className="text-muted-foreground max-w-xs">
                          <Trans>
                            This document has already been sent to this recipient. You can no longer
                            edit this recipient.
                          </Trans>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
