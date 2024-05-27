'use client';

import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-field-meta';
import type { Field } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../../primitives/card';

export type FieldRootContainerProps = {
  field: Field;
  children: React.ReactNode;
};

export type FieldContainerPortalProps = {
  field: Field;
  className?: string;
  children: React.ReactNode;
  cardClassName?: string;
};

export function FieldContainerPortal({
  field,
  children,
  className = '',
}: FieldContainerPortalProps) {
  const coords = useFieldPageCoords(field);

  return createPortal(
    <div
      className={cn('absolute', className)}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function FieldRootContainer({ field, children, cardClassName }: FieldContainerPortalProps) {
  const [isValidating, setIsValidating] = useState(false);

  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new MutationObserver((_mutations) => {
      if (ref.current) {
        setIsValidating(ref.current.getAttribute('data-validate') === 'true');
      }
    });

    observer.observe(ref.current, {
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  let parsedField;

  if (field.fieldMeta) {
    parsedField = ZFieldMetaSchema.parse(field.fieldMeta);
  }

  return (
    <FieldContainerPortal field={field}>
      <Card
        id={`field-${field.id}`}
        className={cn(
          'field-card-container relative z-20 h-full w-full transition-all',
          {
            'bg-documenso/20 border-documenso ring-documenso-200 ring-offset-documenso-200 ring-2 ring-offset-2':
              field.inserted,
          },
          {
            'border-yellow-300 ring-2 ring-yellow-100 ring-offset-2 ring-offset-yellow-100':
              !field.inserted,
          },
          {
            'border-orange-300 ring-1 ring-orange-300': !field.inserted && isValidating,
          },
          {
            'border-red-500 ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 hover:text-red-500':
              !field.inserted && parsedField?.required,
          },
          cardClassName,
        )}
        ref={ref}
        data-inserted={field.inserted ? 'true' : 'false'}
      >
        <CardContent className="text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2">
          {children}
        </CardContent>
      </Card>
    </FieldContainerPortal>
  );
}
