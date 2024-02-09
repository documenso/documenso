import { HTMLAttributes } from 'react';

import { Globe, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import { TemplateType as TemplateTypePrisma } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';

type TemplateTypeIcon = {
  label: string;
  icon?: LucideIcon;
  color: string;
};

type TemplateTypes = (typeof TemplateTypePrisma)[keyof typeof TemplateTypePrisma];

const TEMPLATE_TYPES: Record<TemplateTypes, TemplateTypeIcon> = {
  PRIVATE: {
    label: 'Private',
    icon: Lock,
    color: 'text-blue-600 dark:text-blue-300',
  },
  PUBLIC: {
    label: 'Public',
    icon: Globe,
    color: 'text-green-500 dark:text-green-300',
  },
};

export type TemplateTypeProps = HTMLAttributes<HTMLSpanElement> & {
  type: TemplateTypes;
  inheritColor?: boolean;
};

export const TemplateType = ({ className, type, inheritColor, ...props }: TemplateTypeProps) => {
  const { label, icon: Icon, color } = TEMPLATE_TYPES[type];

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
