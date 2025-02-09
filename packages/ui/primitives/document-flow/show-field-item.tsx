import { useLingui } from '@lingui/react';
import { FieldType, type Prisma } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
import { FRIENDLY_FIELD_TYPE } from './types';

export type ShowFieldItemProps = {
  field: Prisma.FieldGetPayload<null>;
  recipients: Prisma.RecipientGetPayload<null>[];
};

export const ShowFieldItem = ({ field }: ShowFieldItemProps) => {
  const { _ } = useLingui();

  const coords = useFieldPageCoords(field);

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
      <Card className={cn('bg-background h-full w-full [container-type:size]')}>
        <CardContent
          className={cn(
            'text-muted-foreground/50 flex h-full w-full flex-col items-center justify-center p-0 text-[clamp(0.575rem,1.8cqw,1.2rem)] leading-none',
            field.type === FieldType.SIGNATURE && 'font-signature',
          )}
        >
          {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])}

          {/* <p className="text-muted-foreground/50 w-full truncate text-center text-xs">
            {signerEmail}
          </p> */}
        </CardContent>
      </Card>
    </div>,
    document.body,
  );
};
