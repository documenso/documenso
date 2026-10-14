import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import {
  getExtraRecipientsType,
  getRecipientType,
  RecipientStatusType,
} from '@documenso/lib/client-only/recipient-type';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { cn } from '@documenso/ui/lib/utils';
import { PopoverHover } from '@documenso/ui/primitives/popover';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentStatus } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';
import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockIcon,
  CopyIcon,
  MailOpenIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { StackAvatar } from './stack-avatar';

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

  const sections = useMemo(() => {
    const groups = groupRecipientsByStatus(recipients);

    return RECIPIENT_STATUS_SECTIONS.map((section) => ({
      ...section,
      recipients: groups[section.type],
    })).filter((section) => section.recipients.length > 0);
  }, [recipients]);

  const canCopySigningLink = documentStatus === DocumentStatus.PENDING;

  return (
    <PopoverHover
      trigger={children || <RecipientAvatarStack recipients={recipients} />}
      contentProps={{
        className:
          'max-h-[var(--radix-popover-content-available-height)] w-72 divide-y divide-border/50 overflow-y-auto p-0 text-sm',
        side: position,
        // Keep clear of the sticky app header (h-16, z-[60]) which paints above popovers.
        collisionPadding: { top: 72, bottom: 8, left: 8, right: 8 },
        // Opened via hover, so don't steal focus from wherever the user was.
        onOpenAutoFocus: (event) => event.preventDefault(),
      }}
    >
      {sections.map((section) => (
        <div key={section.type} className="px-3 py-2">
          <div className={cn('flex items-center gap-1.5 font-medium text-xs', section.className)}>
            <section.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>{_(section.label)}</span>
            <span>{section.recipients.length}</span>
          </div>

          <div className="mt-1">
            {section.recipients.map((recipient) => (
              <RecipientRow
                key={recipient.id}
                recipient={recipient}
                signingToken={canCopySigningLink && section.hasSigningLink ? recipient.token : null}
              />
            ))}
          </div>
        </div>
      ))}
    </PopoverHover>
  );
};

type RecipientRowProps = {
  recipient: TRecipientLite;
  signingToken: string | null;
};

const RecipientRow = ({ recipient, signingToken }: RecipientRowProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [, copy] = useCopyToClipboard();

  const [isCopied, setIsCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(copiedTimeoutRef.current ?? undefined), []);

  const onCopySigningLink = () => {
    if (!signingToken) {
      return;
    }

    void copy(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${signingToken}`).then(() => {
      setIsCopied(true);

      clearTimeout(copiedTimeoutRef.current ?? undefined);
      copiedTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_INDICATOR_DURATION_MS);

      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The signing link has been copied to your clipboard.`),
      });
    });
  };

  const content = (
    <>
      <StackAvatar
        first={true}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
        className="h-6 w-6 shrink-0 border-0 text-[10px]"
      />

      <div className="min-w-0 flex-1 text-xs leading-snug">
        <p className="truncate text-foreground">{recipient.email || recipient.name}</p>
        <p className="truncate text-muted-foreground">{_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}</p>
      </div>
    </>
  );

  if (!signingToken) {
    return <div className={recipientRowClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        recipientRowClassName,
        'group w-[calc(100%+1rem)] cursor-pointer text-left transition-colors duration-300 hover:bg-muted',
      )}
      title={_(msg`Click to copy signing link for sending to recipient`)}
      onClick={onCopySigningLink}
    >
      {content}

      {isCopied ? (
        <CheckIcon className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
      ) : (
        <CopyIcon className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      )}
    </button>
  );
};

const RecipientAvatarStack = ({ recipients }: { recipients: TRecipientLite[] }) => {
  const sortedRecipients = useMemo(() => {
    const byId = (a: TRecipientLite, b: TRecipientLite) => a.id - b.id;

    const rejected = recipients.filter((r) => getRecipientType(r) === RecipientStatusType.REJECTED);
    const others = recipients.filter((r) => getRecipientType(r) !== RecipientStatusType.REJECTED);

    return [...rejected.sort(byId), ...others.sort(byId)];
  }, [recipients]);

  const visibleRecipients = sortedRecipients.slice(0, MAX_VISIBLE_AVATARS);
  const hiddenRecipients = sortedRecipients.slice(MAX_VISIBLE_AVATARS);

  return (
    <>
      {visibleRecipients.map((recipient, index) => {
        const isOverflowSlot = index === MAX_VISIBLE_AVATARS - 1 && hiddenRecipients.length > 0;
        const zIndex = String(50 - index * 10);

        if (isOverflowSlot) {
          return (
            <StackAvatar
              key="extra-recipients"
              first={index === 0}
              zIndex={zIndex}
              type={getExtraRecipientsType(sortedRecipients.slice(index))}
              fallbackText={`+${hiddenRecipients.length + 1}`}
            />
          );
        }

        return (
          <StackAvatar
            key={recipient.id}
            first={index === 0}
            zIndex={zIndex}
            type={getRecipientType(recipient)}
            fallbackText={recipientAbbreviation(recipient)}
          />
        );
      })}
    </>
  );
};

const groupRecipientsByStatus = (recipients: TRecipientLite[]) => {
  const groups: Record<RecipientStatusType, TRecipientLite[]> = {
    [RecipientStatusType.COMPLETED]: [],
    [RecipientStatusType.REJECTED]: [],
    [RecipientStatusType.WAITING]: [],
    [RecipientStatusType.OPENED]: [],
    [RecipientStatusType.UNSIGNED]: [],
  };

  for (const recipient of recipients) {
    groups[getRecipientType(recipient)].push(recipient);
  }

  return groups;
};

const MAX_VISIBLE_AVATARS = 5;

const COPIED_INDICATOR_DURATION_MS = 2000;

const recipientRowClassName = '-mx-2 flex items-center gap-2 rounded-md px-2 py-1';

type RecipientStatusSection = {
  type: RecipientStatusType;
  label: MessageDescriptor;
  icon: LucideIcon;
  className: string;
  /** Whether recipients in this section still need to sign, so a signing link can be copied. */
  hasSigningLink: boolean;
};

const RECIPIENT_STATUS_SECTIONS: RecipientStatusSection[] = [
  {
    type: RecipientStatusType.COMPLETED,
    label: msg`Completed`,
    icon: CircleCheckIcon,
    className: 'text-green-600 dark:text-green-400',
    hasSigningLink: false,
  },
  {
    type: RecipientStatusType.REJECTED,
    label: msg`Rejected`,
    icon: CircleXIcon,
    className: 'text-red-600 dark:text-red-400',
    hasSigningLink: false,
  },
  {
    type: RecipientStatusType.WAITING,
    label: msg`Waiting`,
    icon: ClockIcon,
    className: 'text-blue-600 dark:text-blue-400',
    hasSigningLink: true,
  },
  {
    type: RecipientStatusType.OPENED,
    label: msg`Opened`,
    icon: MailOpenIcon,
    className: 'text-amber-600 dark:text-amber-400',
    hasSigningLink: true,
  },
  {
    type: RecipientStatusType.UNSIGNED,
    label: msg`Uncompleted`,
    icon: CircleDashedIcon,
    className: 'text-muted-foreground',
    hasSigningLink: true,
  },
];
