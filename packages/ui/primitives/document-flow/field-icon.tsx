import { Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Contact,
  Disc,
  Hash,
  Mail,
  Type,
  User,
} from 'lucide-react';

import type { TFieldMetaSchema as FieldMetaType } from '@documenso/lib/types/field-meta';

import { cn } from '../../lib/utils';

type FieldIconProps = {
  fieldMeta: FieldMetaType;
  type: FieldType;
};

const fieldIcons = {
  [FieldType.INITIALS]: { icon: Contact, label: 'Initials' },
  [FieldType.EMAIL]: { icon: Mail, label: 'Email' },
  [FieldType.NAME]: { icon: User, label: 'Name' },
  [FieldType.DATE]: { icon: CalendarDays, label: 'Date' },
  [FieldType.TEXT]: { icon: Type, label: 'Text' },
  [FieldType.NUMBER]: { icon: Hash, label: 'Number' },
  [FieldType.RADIO]: { icon: Disc, label: 'Radio' },
  [FieldType.CHECKBOX]: { icon: CheckSquare, label: 'Checkbox' },
  [FieldType.DROPDOWN]: { icon: ChevronDown, label: 'Select' },
};

export const FieldIcon = ({ fieldMeta, type }: FieldIconProps) => {
  if (type === 'SIGNATURE' || type === 'FREE_SIGNATURE') {
    return (
      <div
        className={cn(
          'text-field-card-foreground font-signature flex items-center justify-center gap-x-1 text-[clamp(0.575rem,25cqw,1.2rem)]',
        )}
      >
        <Trans>Signature</Trans>
      </div>
    );
  } else {
    const Icon = fieldIcons[type]?.icon;
    let label;

    if (fieldMeta && (type === 'TEXT' || type === 'NUMBER')) {
      if (type === 'TEXT' && 'text' in fieldMeta && fieldMeta.text && !fieldMeta.label) {
        label =
          fieldMeta.text.length > 20 ? fieldMeta.text.substring(0, 20) + '...' : fieldMeta.text;
      } else if (fieldMeta.label) {
        label =
          fieldMeta.label.length > 20 ? fieldMeta.label.substring(0, 20) + '...' : fieldMeta.label;
      } else {
        label = fieldIcons[type]?.label;
      }
    } else {
      label = fieldIcons[type]?.label;
    }

    return (
      <div className="text-field-card-foreground flex items-center justify-center gap-x-1.5 text-[clamp(0.425rem,25cqw,0.825rem)]">
        <Icon className="h-[clamp(0.625rem,20cqw,0.925rem)] w-[clamp(0.625rem,20cqw,0.925rem)]" />{' '}
        {label}
      </div>
    );
  }
};
