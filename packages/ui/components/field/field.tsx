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

  const isCheckboxOrRadioField = field.type === 'CHECKBOX' || field.type === 'RADIO';
  const isFieldSigned = field.inserted;

  const style = {
    top: `${coords.y}px`,
    left: `${coords.x}px`,
    ...((!isCheckboxOrRadioField || isFieldSigned) && {
      height: `${coords.height}px`,
      width: `${coords.width}px`,
    }),
  };

  return createPortal(
    <div className={cn('absolute', className)} style={style}>
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

  const checkBoxOrRadio = parsedField?.type === 'checkbox' || parsedField?.type === 'radio';

  return (
    <FieldContainerPortal field={field}>
      {checkBoxOrRadio ? (
        <Card
          id={`field-${field.id}`}
          ref={ref}
          data-inserted={field.inserted ? 'true' : 'false'}
          className={cn(
            {
              'border-documenso border-dashed shadow-none': field.inserted,
            },
            {
              'border-dashed border-yellow-300': !field.inserted && !parsedField?.required,
            },
            {
              'shadow-none': !field.inserted && checkBoxOrRadio,
            },
            {
              'border-orange-300 ring-1 ring-orange-300': !field.inserted && isValidating,
            },
            {
              'border-dashed border-red-500 hover:text-red-500':
                !field.inserted && parsedField?.required && checkBoxOrRadio,
            },
            cardClassName,
          )}
        >
          <CardContent className="text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2">
            {children}
          </CardContent>
        </Card>
      ) : (
        <Card
          id={`field-${field.id}`}
          className={cn(
            'field-card-container relative z-20 h-full w-full transition-all',
            {
              'bg-documenso/20 border-documenso ring-documenso-200 ring-offset-documenso-200 ring-2 ring-offset-2':
                field.inserted,
            },
            {
              'border-yellow-300 shadow-none ring-2 ring-yellow-100 ring-offset-2 ring-offset-yellow-100 dark:border-2':
                !field.inserted && !checkBoxOrRadio,
            },
            {
              'shadow-none': !field.inserted && checkBoxOrRadio,
            },
            {
              'border-orange-300 ring-1 ring-orange-300': !field.inserted && isValidating,
            },
            {
              'border-red-500 shadow-none ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 hover:text-red-500':
                !field.inserted && parsedField?.required && !checkBoxOrRadio,
            },
            {
              'border-dashed border-red-500 hover:text-red-500':
                !field.inserted && parsedField?.required && checkBoxOrRadio,
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
      )}
    </FieldContainerPortal>
  );
}
