import { useCallback, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { RecipientRole, SendStatus } from '@prisma/client';
import { Check, ChevronsUpDown, Info } from 'lucide-react';
import { sortBy } from 'remeda';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@documenso/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export interface EnvelopeRecipientSelectorProps {
  className?: string;
  selectedRecipient: Recipient | null;
  onSelectedRecipientChange: (recipient: Recipient) => void;
  recipients: Recipient[];
  fields: Field[];
  align?: 'center' | 'end' | 'start';
}

export const EnvelopeRecipientSelector = ({
  className,
  selectedRecipient,
  onSelectedRecipientChange,
  recipients,
  fields,
  align = 'start',
}: EnvelopeRecipientSelectorProps) => {
  const [showRecipientsSelector, setShowRecipientsSelector] = useState(false);

  return (
    <Popover open={showRecipientsSelector} onOpenChange={setShowRecipientsSelector}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'bg-background text-muted-foreground hover:text-foreground justify-between font-normal',
            getRecipientColorStyles(
              Math.max(
                recipients.findIndex((r) => r.id === selectedRecipient?.id),
                0,
              ),
            ).comboxBoxTrigger,
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

      <PopoverContent className="p-0" align={align}>
        <EnvelopeRecipientSelectorCommand
          fields={fields}
          selectedRecipient={selectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            onSelectedRecipientChange(recipient);
            setShowRecipientsSelector(false);
          }}
          recipients={recipients}
        />
      </PopoverContent>
    </Popover>
  );
};

interface EnvelopeRecipientSelectorCommandProps {
  className?: string;
  selectedRecipient: Recipient | null;
  onSelectedRecipientChange: (recipient: Recipient) => void;
  recipients: Recipient[];
  fields: Field[];
  placeholder?: string;
}

export const EnvelopeRecipientSelectorCommand = ({
  className,
  selectedRecipient,
  onSelectedRecipientChange,
  recipients,
  fields,
  placeholder,
}: EnvelopeRecipientSelectorCommandProps) => {
  const { t } = useLingui();

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

  const isRecipientDisabled = useCallback(
    (recipientId: number) => {
      const recipient = recipients.find((r) => r.id === recipientId);
      const recipientFields = fields.filter((f) => f.recipientId === recipientId);

      return !recipient || !canRecipientFieldsBeModified(recipient, recipientFields);
    },
    [fields, recipients],
  );

  return (
    <Command
      value={selectedRecipient ? selectedRecipient.id.toString() : undefined}
      className={className}
    >
      <CommandInput placeholder={placeholder} />

      <CommandEmpty>
        <span className="text-muted-foreground inline-block px-4">
          <Trans>No recipient matching this description was found.</Trans>
        </span>
      </CommandEmpty>

      {recipientsByRoleToDisplay().map(([role, roleRecipients], roleIndex) => (
        <CommandGroup key={roleIndex}>
          <div className="text-muted-foreground mb-1 ml-2 mt-2 text-xs font-medium">
            {t(RECIPIENT_ROLES_DESCRIPTION[role].roleNamePlural)}
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
                getRecipientColorStyles(
                  Math.max(
                    recipients.findIndex((r) => r.id === recipient.id),
                    0,
                  ),
                ).comboxBoxItem,
                {
                  'text-muted-foreground': recipient.sendStatus === SendStatus.SENT,
                  'cursor-not-allowed': isRecipientDisabled(recipient.id),
                },
              )}
              onSelect={() => {
                if (!isRecipientDisabled(recipient.id)) {
                  onSelectedRecipientChange(recipient);
                }
              }}
            >
              <span
                className={cn('text-foreground/70 truncate', {
                  'text-foreground/80': recipient.id === selectedRecipient?.id,
                  'opacity-50': isRecipientDisabled(recipient.id),
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
                {!isRecipientDisabled(recipient.id) ? (
                  <Check
                    aria-hidden={recipient.id !== selectedRecipient?.id}
                    className={cn('h-4 w-4 flex-shrink-0', {
                      'opacity-0': recipient.id !== selectedRecipient?.id,
                      'opacity-100': recipient.id === selectedRecipient?.id,
                    })}
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger disabled={false}>
                      <Info className="z-50 ml-2 h-4 w-4" />
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
  );
};
