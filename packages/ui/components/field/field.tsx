import React, { useEffect, useState } from 'react';

import { type Field, FieldType } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';

import type { RecipientColorStyles } from '../../lib/recipient-colors';
import { cn } from '../../lib/utils';

export type FieldContainerPortalProps = {
  field: Field;
  className?: string;
  children: React.ReactNode;
};

export function FieldContainerPortal({
  field,
  children,
  className = '',
}: FieldContainerPortalProps) {
  const coords = useFieldPageCoords(field);

  const isCheckboxOrRadioField = field.type === 'CHECKBOX' || field.type === 'RADIO';

  const style = {
    top: `${coords.y}px`,
    left: `${coords.x}px`,
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

export type FieldRootContainerProps = {
  field: Field;
  color?: RecipientColorStyles;
  children: React.ReactNode;
  className?: string;
};

export function FieldRootContainer({ field, children, color, className }: FieldRootContainerProps) {
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

  return (
    <FieldContainerPortal field={field}>
      <div
        id={`field-${field.id}`}
        ref={ref}
        data-field-type={field.type}
        data-inserted={field.inserted ? 'true' : 'false'}
        className={cn(
          'field--FieldRootContainer field-card-container dark-mode-disabled group relative z-20 flex h-full w-full items-center rounded-[2px] bg-white/90 ring-2 ring-gray-200 transition-all',
          color?.base,
          {
            'px-2': field.type !== FieldType.SIGNATURE && field.type !== FieldType.FREE_SIGNATURE,
            'justify-center': !field.inserted,
            'ring-orange-300': isValidating && isFieldUnsignedAndRequired(field),
          },
          className,
        )}
      >
        {children}
      </div>
    </FieldContainerPortal>
  );
}
