import React, { useEffect, useMemo, useState } from 'react';

import type { Field } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

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

const getCardClassNames = (
  field: Field,
  parsedField: TFieldMetaSchema | null,
  isValidating: boolean,
  checkBoxOrRadio: boolean,
  cardClassName?: string,
) => {
  const baseClasses =
    'field--FieldRootContainer field-card-container relative z-20 h-full w-full transition-all';

  const insertedClasses =
    'bg-primary/20 border-primary ring-primary/20 ring-offset-primary/20 ring-2 ring-offset-2 dark:shadow-none';
  const nonRequiredClasses =
    'border-yellow-300 shadow-none ring-2 ring-yellow-100 ring-offset-2 ring-offset-yellow-100 dark:border-2';
  const validatingClasses = 'border-orange-300 ring-1 ring-orange-300';
  const requiredClasses =
    'border-red-500 shadow-none ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 hover:text-red-500';
  const requiredCheckboxRadioClasses = 'border-dashed border-red-500';

  if (checkBoxOrRadio) {
    return cn(
      {
        [insertedClasses]: field.inserted,
        'ring-offset-yellow-200 border-dashed border-yellow-300 ring-2 ring-yellow-200 ring-offset-2 dark:shadow-none':
          !field.inserted && !parsedField?.required,
        'shadow-none': !field.inserted,
        [validatingClasses]: !field.inserted && isValidating,
        [requiredCheckboxRadioClasses]: !field.inserted && parsedField?.required,
      },
      cardClassName,
    );
  }

  return cn(
    baseClasses,
    {
      [insertedClasses]: field.inserted,
      [nonRequiredClasses]: !field.inserted && !parsedField?.required,
      'shadow-none': !field.inserted && checkBoxOrRadio,
      [validatingClasses]: !field.inserted && isValidating,
      [requiredClasses]: !field.inserted && parsedField?.required && !checkBoxOrRadio,
    },
    cardClassName,
  );
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
    // height: `${coords.height}px`,
    // width: `${coords.width}px`,
    ...(!isCheckboxOrRadioField && {
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

  const parsedField = useMemo(
    () => (field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null),
    [field.fieldMeta],
  );
  const isCheckboxOrRadio = useMemo(
    () => parsedField?.type === 'checkbox' || parsedField?.type === 'radio',
    [parsedField],
  );

  const cardClassNames = useMemo(
    () => getCardClassNames(field, parsedField, isValidating, isCheckboxOrRadio, cardClassName),
    [field, parsedField, isValidating, isCheckboxOrRadio, cardClassName],
  );

  return (
    <FieldContainerPortal field={field}>
      <Card
        id={`field-${field.id}`}
        ref={ref}
        data-field-type={field.type}
        data-inserted={field.inserted ? 'true' : 'false'}
        className={cardClassNames}
      >
        <CardContent className="text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2">
          {children}
        </CardContent>
      </Card>
    </FieldContainerPortal>
  );
}
