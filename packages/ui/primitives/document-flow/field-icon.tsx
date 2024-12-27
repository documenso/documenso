import { Trans } from '@lingui/macro';
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
import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';

type FieldIconProps = {
  fieldMeta: FieldMetaType;
  type: FieldType;
  signerEmail?: string;
  fontCaveatClassName?: string;
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
          'text-field-card-foreground flex items-center justify-center gap-x-1 text-[clamp(0.575rem,25cqw,1.2rem)]',
          fontCaveatClassName,
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
          fieldMeta.text.length > 10 ? fieldMeta.text.substring(0, 10) + '...' : fieldMeta.text;
      } else if (fieldMeta.label) {
        label =
          fieldMeta.label.length > 10 ? fieldMeta.label.substring(0, 10) + '...' : fieldMeta.label;
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
