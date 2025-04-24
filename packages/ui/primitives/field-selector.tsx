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

import { cn } from '../lib/utils';
import { Card, CardContent } from './card';

export interface FieldSelectorProps {
  className?: string;
  selectedField: FieldType | null;
  onSelectedFieldChange: (fieldType: FieldType) => void;
  disabled?: boolean;
}

export const FieldSelector = ({
  className,
  selectedField,
  onSelectedFieldChange,
  disabled = false,
}: FieldSelectorProps) => {
  const fieldTypes = [
    {
      type: FieldType.SIGNATURE,
      label: 'Signature',
      icon: null,
    },
    {
      type: FieldType.INITIALS,
      label: 'Initials',
      icon: Contact,
    },
    {
      type: FieldType.EMAIL,
      label: 'Email',
      icon: Mail,
    },
    {
      type: FieldType.NAME,
      label: 'Name',
      icon: User,
    },
    {
      type: FieldType.DATE,
      label: 'Date',
      icon: CalendarDays,
    },
    {
      type: FieldType.TEXT,
      label: 'Text',
      icon: Type,
    },
    {
      type: FieldType.NUMBER,
      label: 'Number',
      icon: Hash,
    },
    {
      type: FieldType.RADIO,
      label: 'Radio',
      icon: Disc,
    },
    {
      type: FieldType.CHECKBOX,
      label: 'Checkbox',
      icon: CheckSquare,
    },
    {
      type: FieldType.DROPDOWN,
      label: 'Dropdown',
      icon: ChevronDown,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {fieldTypes.map((field) => {
        const Icon = field.icon;

        return (
          <button
            key={field.type}
            type="button"
            className="group w-full"
            onPointerDown={() => onSelectedFieldChange(field.type)}
            disabled={disabled}
            data-selected={selectedField === field.type ? true : undefined}
          >
            <Card
              className={cn(
                'flex w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                {
                  'border-primary': selectedField === field.type,
                },
              )}
            >
              <CardContent className="relative flex items-center justify-center gap-x-2 px-6 py-4">
                {Icon && <Icon className="text-muted-foreground h-4 w-4" />}
                <span
                  className={cn(
                    'text-muted-foreground group-data-[selected]:text-foreground text-sm',
                    field.type === FieldType.SIGNATURE && 'invisible',
                  )}
                >
                  {field.label}
                </span>

                {field.type === FieldType.SIGNATURE && (
                  <div className="text-muted-foreground font-signature absolute inset-0 flex items-center justify-center text-lg">
                    Signature
                  </div>
                )}
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
};
