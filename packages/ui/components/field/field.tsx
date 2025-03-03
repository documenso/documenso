import React, { useEffect, useState } from 'react';

import type { Field } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';

import { useSignerColors } from '../../lib/signer-colors';
import { cn } from '../../lib/utils';

export type FieldRootContainerProps = {
  field: Field;
  children: React.ReactNode;
};

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

export function FieldRootContainer({ field, children }: FieldContainerPortalProps) {
  const [isValidating, setIsValidating] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const signerStyles = useSignerColors(field.recipientId);

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

  // // todo: remove
  // const parsedField = useMemo(
  //   () => (field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null),
  //   [field.fieldMeta],
  // );

  // // todo: remove
  // const isCheckboxOrRadio = useMemo(
  //   () => parsedField?.type === 'checkbox' || parsedField?.type === 'radio',
  //   [parsedField],
  // );

  return (
    <FieldContainerPortal field={field}>
      <div
        id={`field-${field.id}`}
        ref={ref}
        data-field-type={field.type}
        data-inserted={field.inserted ? 'true' : 'false'}
        className={cn(
          'field--FieldRootContainer field-card-container relative z-20 h-full w-full rounded-sm ring-2 transition-all',
          'ring-signer-green bg-white/90',
          'px-2', // This is specific to try sync with field insertion. See insert-field-in-pdf before changing this.
          {
            'flex items-center justify-center': !field.inserted,
          },
        )}
      >
        {children}
      </div>
    </FieldContainerPortal>
  );
}
