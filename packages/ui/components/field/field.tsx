import React, { useEffect, useMemo, useState } from 'react';

import { type Field, FieldType } from '@prisma/client';
import { createPortal } from 'react-dom';

import { useElementBounds } from '@documenso/lib/client-only/hooks/use-element-bounds';
import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
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
  const alternativePortalRoot = document.getElementById('document-field-portal-root');

  const coords = useFieldPageCoords(field);
  const $pageBounds = useElementBounds(
    `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
  );

  const maxWidth = $pageBounds?.width ? $pageBounds.width - coords.x : undefined;

  const isCheckboxOrRadioField = field.type === 'CHECKBOX' || field.type === 'RADIO';

  const style = useMemo(() => {
    const portalBounds = alternativePortalRoot?.getBoundingClientRect();

    const bounds = {
      top: `${coords.y}px`,
      left: `${coords.x}px`,
      ...(!isCheckboxOrRadioField
        ? {
            height: `${coords.height}px`,
            width: `${coords.width}px`,
          }
        : {
            maxWidth: `${maxWidth}px`,
          }),
    };

    if (portalBounds) {
      bounds.top = `${coords.y - portalBounds.top}px`;
      bounds.left = `${coords.x - portalBounds.left}px`;
    }

    return bounds;
  }, [coords, maxWidth, isCheckboxOrRadioField]);

  return createPortal(
    <div className={cn('absolute', className)} style={style}>
      {children}
    </div>,
    alternativePortalRoot ?? document.body,
  );
}

export type FieldRootContainerProps = {
  field: Field;
  color?: RecipientColorStyles;
  children: React.ReactNode;
  className?: string;
  readonly?: boolean;
};

export function FieldRootContainer({
  field,
  children,
  color,
  className,
  readonly,
}: FieldRootContainerProps) {
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
        data-readonly={readonly ? 'true' : 'false'}
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
