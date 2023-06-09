import { HTMLAttributes } from 'react';

import { CheckCircle2, Clock, File, LucideIcon } from 'lucide-react';

import { DocumentStatus as InternalDocumentStatus } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';

type FriendlyStatus = {
  label: string;
  icon: LucideIcon;
  color: string;
};

const FRIENDLY_STATUS_MAP: Record<InternalDocumentStatus, FriendlyStatus> = {
  DRAFT: {
    label: 'Draft',
    icon: File,
    color: 'text-yellow-500',
  },
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'text-blue-600',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
};

export type DocumentStatusProps = HTMLAttributes<HTMLSpanElement> & {
  status: InternalDocumentStatus;
};

export const DocumentStatus = ({ className, status, ...props }: DocumentStatusProps) => {
  const { label, icon: Icon, color } = FRIENDLY_STATUS_MAP[status];

  return (
    <span className={cn('flex items-center', className)} {...props}>
      <Icon className={cn('mr-2 inline-block h-4 w-4', color)} />
      {label}
    </span>
  );
};
