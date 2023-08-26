'use client';

import React from 'react';

import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { useFieldPageCoords } from '~/hooks/use-field-page-coords';

export type SignatureFieldProps = {
  field: FieldWithSignature;
  loading?: boolean;
  children: React.ReactNode;
  onSign?: () => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
};

export const SigningFieldContainer = ({
  field,
  loading,
  onSign,
  onRemove,
  children,
}: SignatureFieldProps) => {
  const coords = useFieldPageCoords(field);

  const onSignFieldClick = async () => {
    if (field.inserted) {
      return;
    }

    await onSign?.();
  };

  const onRemoveSignedFieldClick = async () => {
    if (!field.inserted) {
      return;
    }

    await onRemove?.();
  };

  return (
    <div
      className="absolute"
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      <Card
        className="bg-background relative h-full w-full"
        data-inserted={field.inserted ? 'true' : 'false'}
      >
        <CardContent
          className={cn(
            'text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2',
          )}
        >
          <button
            type="submit"
            className={`
              absolute inset-0 z-10 ${field.inserted ? 'text-destructive bg-background/40' : ''}
            `}
            onClick={field.inserted ? onRemoveSignedFieldClick : onSignFieldClick}
            disabled={loading}
          >
            {field.inserted ? 'Remove' : ''}
          </button>
          {children}
        </CardContent>
      </Card>
    </div>
  );
};
