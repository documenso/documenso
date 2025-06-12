import type { HTMLAttributes } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CheckCircle2, Clock, File, Loader2, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import type { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { cn } from '@documenso/ui/lib/utils';

type FriendlyStatus = {
  label: MessageDescriptor;
  labelExtended: MessageDescriptor;
  icon?: LucideIcon;
  color: string;
  animate?: boolean;
};

export const FRIENDLY_STATUS_MAP: Record<ExtendedDocumentStatus, FriendlyStatus> = {
  PENDING: {
    label: msg`Pending`,
    labelExtended: msg`Document pending`,
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-300',
  },
  COMPLETED: {
    label: msg`Completed`,
    labelExtended: msg`Document completed`,
    icon: CheckCircle2,
    color: 'text-green-500 dark:text-green-300',
  },
  DRAFT: {
    label: msg`Draft`,
    labelExtended: msg`Document draft`,
    icon: File,
    color: 'text-yellow-500 dark:text-yellow-200',
  },
  REJECTED: {
    label: msg`Rejected`,
    labelExtended: msg`Document rejected`,
    icon: XCircle,
    color: 'text-red-500 dark:text-red-300',
  },
  INBOX: {
    label: msg`Inbox`,
    labelExtended: msg`Document inbox`,
    icon: SignatureIcon,
    color: 'text-muted-foreground',
  },
  ALL: {
    label: msg`All`,
    labelExtended: msg`Document All`,
    color: 'text-muted-foreground',
  },
};

const PROCESSING_STATUS: FriendlyStatus = {
  label: msg`Processing`,
  labelExtended: msg`Document processing`,
  icon: Loader2,
  color: 'text-blue-600 dark:text-blue-300',
  animate: true,
};

export type DocumentStatusProps = HTMLAttributes<HTMLSpanElement> & {
  status: ExtendedDocumentStatus;
  inheritColor?: boolean;
  isProcessing?: boolean;
};

export const DocumentStatus = ({
  className,
  status,
  inheritColor,
  isProcessing,
  ...props
}: DocumentStatusProps) => {
  const { _ } = useLingui();

  const statusConfig = isProcessing ? PROCESSING_STATUS : FRIENDLY_STATUS_MAP[status];
  const { label, icon: Icon, color, animate } = statusConfig;

  return (
    <span className={cn('flex items-center', className)} {...props}>
      {Icon && (
        <Icon
          className={cn('mr-2 inline-block h-4 w-4', {
            [color]: !inheritColor,
            'animate-spin': animate,
          })}
        />
      )}
      {_(label)}
    </span>
  );
};
