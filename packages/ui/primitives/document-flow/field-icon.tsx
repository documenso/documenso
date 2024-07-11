import { CalendarDays, CheckSquare, ChevronDown, Disc, Hash, Mail, Type, User } from 'lucide-react';

import type { TFieldMetaSchema as FieldMetaType } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';

type FieldIconProps = {
  fieldMeta: FieldMetaType;
  type: FieldType;
  signerEmail?: string;
  fontCaveatClassName?: string;
};

const fieldIcons = {
  [FieldType.EMAIL]: { icon: Mail, label: 'Email' },
  [FieldType.NAME]: { icon: User, label: 'Name' },
  [FieldType.DATE]: { icon: CalendarDays, label: 'Date' },
  [FieldType.TEXT]: { icon: Type, label: 'Add text' },
  [FieldType.NUMBER]: { icon: Hash, label: 'Add number' },
  [FieldType.RADIO]: { icon: Disc, label: 'Radio' },
  [FieldType.CHECKBOX]: { icon: CheckSquare, label: 'Checkbox' },
  [FieldType.DROPDOWN]: { icon: ChevronDown, label: 'Select' },
};

export const FieldIcon = ({
  fieldMeta,
  type,
  signerEmail,
  fontCaveatClassName,
}: FieldIconProps) => {
  if (type === 'SIGNATURE' || type === 'FREE_SIGNATURE') {
    return (
      <div
        className={cn(
          'text-field-card-foreground flex items-center justify-center gap-x-1 text-xl',
          fontCaveatClassName,
        )}
      >
        Signature
      </div>
    );
  } else {
    const Icon = fieldIcons[type]?.icon;
    let label;

    if (fieldMeta && (type === 'TEXT' || type === 'NUMBER')) {
      if (type === 'TEXT' && 'text' in fieldMeta && fieldMeta.text && !fieldMeta.label) {
        label = fieldMeta.text.length > 10 ? fieldMeta.text.substring(0, 10) + '...' : fieldMeta.text;
      } else if (fieldMeta.label) {
        label = fieldMeta.label.length > 10 ? fieldMeta.label.substring(0, 10) + '...' : fieldMeta.label;
      } else {
        label = fieldIcons[type]?.label;
      }
    } else {
      label = fieldIcons[type]?.label;
    }

    return (
      <div className="text-field-card-foreground flex items-center justify-center gap-x-1.5 text-sm">
        <Icon className='h-4 w-4' /> {label}
      </div>
    );
  }
};
