'use client';

import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import { Field } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

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

export function FieldRootContainer({ field, children }: FieldContainerPortalProps) {
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
      <Card
        id={`field-${field.id}`}
        className={cn(
          'field-card-container bg-background relative z-20 h-full w-full transition-all',
          {
            'border-orange-300 ring-1 ring-orange-300': !field.inserted && isValidating,
          },
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
