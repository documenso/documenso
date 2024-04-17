'use client';

import React from 'react';

import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldRootContainer } from '@documenso/ui/components/field/field';

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
    <FieldRootContainer field={field}>
      {!field.inserted && !loading && (
        <button
          type="submit"
          className="absolute inset-0 z-10 h-full w-full"
          onClick={onSignFieldClick}
        />
      )}

      {field.inserted && !loading && (
        <button
          className="text-destructive bg-background/40 absolute inset-0 z-10 flex h-full w-full items-center justify-center rounded-md text-sm opacity-0 backdrop-blur-sm duration-200 group-hover:opacity-100"
          onClick={onRemoveSignedFieldClick}
        >
          Remove
        </button>
      )}

      {children}
    </FieldRootContainer>
  );
};
