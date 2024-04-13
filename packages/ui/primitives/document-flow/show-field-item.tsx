'use client';

import type { Prisma } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
import { Checkbox } from '../checkbox';
import { FRIENDLY_FIELD_TYPE } from './types';

export type ShowFieldItemProps = {
  field: Prisma.FieldGetPayload<null>;
  recipients: Prisma.RecipientGetPayload<null>[];
};

export const ShowFieldItem = ({ field, recipients }: ShowFieldItemProps) => {
  const coords = useFieldPageCoords(field);

  const signerEmail =
    recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '';
  const isCheckboxField = field.type === FieldType.CHECKBOX;

  return createPortal(
    <div
      className={cn('pointer-events-none absolute z-10 opacity-75')}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      {!isCheckboxField && (
        <Card className={cn('bg-background h-full w-full')}>
          <CardContent
            className={cn(
              'text-muted-foreground/50 flex h-full w-full flex-col items-center justify-center p-2',
            )}
          >
            {FRIENDLY_FIELD_TYPE[field.type]}

            <p className="text-muted-foreground/50 w-full truncate text-center text-xs">
              {signerEmail}
            </p>
          </CardContent>
        </Card>
      )}

      {isCheckboxField && (
        <Checkbox
          className={cn(
            'h-8 w-8',
            'shadow-[0_0_0_4px_theme(colors.gray.100/70%),0_0_0_1px_theme(colors.gray.100/70%),0_0_0_0.5px_theme(colors.primary.DEFAULT/70%)]',
          )}
        />
      )}
    </div>,
    document.body,
  );
};
