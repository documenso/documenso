import { CalendarDays, CheckSquare, ChevronDown, Disc, Hash, Mail, Type, User } from 'lucide-react';

import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';

type FieldIconProps = {
  type: FieldType;
  signerEmail?: string;
  fontCaveatClassName?: string;
};

const fieldIcons = {
  [FieldType.EMAIL]: { icon: Mail, label: 'Email' },
  [FieldType.NAME]: { icon: User, label: 'Name' },
  [FieldType.DATE]: { icon: CalendarDays, label: 'Date' },
  [FieldType.TEXT]: { icon: Type, label: 'Text' },
  [FieldType.NUMBER]: { icon: Hash, label: 'Number' },
  [FieldType.RADIO]: { icon: Disc, label: 'Radio' },
  [FieldType.CHECKBOX]: { icon: CheckSquare, label: 'Checkbox' },
  [FieldType.DROPDOWN]: { icon: ChevronDown, label: 'Dropdown' },
};

export const FieldIcon = ({ type, signerEmail, fontCaveatClassName }: FieldIconProps) => {
  if (type === 'SIGNATURE' || type === 'FREE_SIGNATURE') {
    return (
      <div
        className={cn(
          'text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light',
          fontCaveatClassName,
        )}
      >
        {signerEmail}
      </div>
    );
  } else {
    const Icon = fieldIcons[type]?.icon;
    const label = fieldIcons[type]?.label;

    return (
      <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
        <Icon /> {label}
      </div>
    );
  }
};
