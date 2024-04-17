import { HTMLAttributes } from 'react';

import { CheckCircle2, Clock, File } from 'lucide-react';
import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { cn } from '@documenso/ui/lib/utils';

type FriendlyStatus = {
  label: string;
  icon?: LucideIcon;
  color: string;
};

const FRIENDLY_STATUS_MAP: Record<ExtendedDocumentStatus, FriendlyStatus> = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-300',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-500 dark:text-green-300',
  },
  DRAFT: {
    label: 'Draft',
    icon: File,
    color: 'text-yellow-500 dark:text-yellow-200',
  },
  INBOX: {
    label: 'Inbox',
    icon: SignatureIcon,
    color: 'text-muted-foreground',
  },
  ALL: {
    label: 'All',
    color: 'text-muted-foreground',
  },
};

export type DocumentStatusProps = HTMLAttributes<HTMLSpanElement> & {
  status: ExtendedDocumentStatus;
  inheritColor?: boolean;
};

export const DocumentStatus = ({
  className,
  status,
  inheritColor,
  ...props
}: DocumentStatusProps) => {
  const { label, icon: Icon, color } = FRIENDLY_STATUS_MAP[status];

  return (
    <span className={cn('flex items-center', className)} {...props}>
      {Icon && (
        <Icon
          className={cn('mr-2 inline-block h-4 w-4', {
            [color]: !inheritColor,
          })}
        />
      )}
      {label}
    </span>
  );
};
