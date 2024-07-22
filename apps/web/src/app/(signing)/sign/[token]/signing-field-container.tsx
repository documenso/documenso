'use client';

import React from 'react';

import { X } from 'lucide-react';

import { type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { cn } from '@documenso/ui/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type SignatureFieldProps = {
  field: FieldWithSignature;
  loading?: boolean;
  children: React.ReactNode;

  /**
   * A function that is called before the field requires to be signed, or reauthed.
   *
   * Example, you may want to show a dialog prior to signing where they can enter a value.
   *
   * Once that action is complete, you will need to call `executeActionAuthProcedure` to proceed
   * regardless if it requires reauth or not.
   *
   * If the function returns true, we will proceed with the signing process. Otherwise if
   * false is returned we will not proceed.
   */
  onPreSign?: () => Promise<boolean> | boolean;

  /**
   * The function required to be executed to insert the field.
   *
   * The auth values will be passed in if available.
   */
  onSign?: (documentAuthValue?: TRecipientActionAuth) => Promise<void> | void;
  onRemove?: (fieldType?: string) => Promise<void> | void;
  type?: 'Date' | 'Email' | 'Name' | 'Signature' | 'Radio' | 'Dropdown' | 'Number' | 'Checkbox';
  tooltipText?: string | null;
};

export const SigningFieldContainer = ({
  field,
  loading,
  onPreSign,
  onSign,
  onRemove,
  children,
  type,
  tooltipText,
}: SignatureFieldProps) => {
  const { executeActionAuthProcedure, isAuthRedirectRequired } = useRequiredDocumentAuthContext();

  const parsedFieldMeta = field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined;
  const readOnlyField = parsedFieldMeta?.readOnly || false;

  const handleInsertField = async () => {
    if (field.inserted || !onSign) {
      return;
    }

    // Bypass reauth for non signature fields.
    if (field.type !== FieldType.SIGNATURE) {
      const presignResult = await onPreSign?.();

      if (presignResult === false) {
        return;
      }

      await onSign();
      return;
    }

    if (isAuthRedirectRequired) {
      await executeActionAuthProcedure({
        onReauthFormSubmit: () => {
          // Do nothing since the user should be redirected.
        },
        actionTarget: field.type,
      });

      return;
    }

    // Handle any presign requirements, and halt if required.
    if (onPreSign) {
      const preSignResult = await onPreSign();

      if (preSignResult === false) {
        return;
      }
    }

    await executeActionAuthProcedure({
      onReauthFormSubmit: onSign,
      actionTarget: field.type,
    });
  };

  const onRemoveSignedFieldClick = async () => {
    if (!field.inserted) {
      return;
    }

    await onRemove?.();
  };

  const onClearCheckBoxValues = async (fieldType?: string) => {
    if (!field.inserted) {
      return;
    }

    await onRemove?.(fieldType);
  };

  return (
    <div className={cn(type === 'Checkbox' ? 'group' : '')}>
      <FieldRootContainer field={field}>
        {!field.inserted && !loading && !readOnlyField && (
          <button
            type="submit"
            className="absolute inset-0 z-10 h-full w-full rounded-md border"
            onClick={async () => handleInsertField()}
          />
        )}

        {readOnlyField && (
          <button className="bg-background/40 absolute inset-0 z-10 flex h-full w-full items-center justify-center rounded-md text-sm opacity-0 duration-200 group-hover:opacity-100">
            <span className="bg-foreground/50 dark:bg-background/50 text-background dark:text-foreground rounded-xl p-2">
              Read only field
            </span>
          </button>
        )}

        {type === 'Date' && field.inserted && !loading && !readOnlyField && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                className="text-destructive bg-background/40 absolute inset-0 z-10 flex h-full w-full items-center justify-center rounded-md text-sm opacity-0 duration-200 group-hover:opacity-100"
                onClick={onRemoveSignedFieldClick}
              >
                Remove
              </button>
            </TooltipTrigger>

            {tooltipText && <TooltipContent className="max-w-xs">{tooltipText}</TooltipContent>}
          </Tooltip>
        )}

        {type === 'Checkbox' && field.inserted && !loading && !readOnlyField && (
          <button
            className="dark:bg-background absolute -bottom-10 flex items-center justify-evenly rounded-md border bg-gray-900 opacity-0 group-hover:opacity-100"
            onClick={() => void onClearCheckBoxValues(type)}
          >
            <span className="dark:text-muted-foreground/50 dark:hover:text-muted-foreground dark:hover:bg-foreground/10 rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100">
              <X className="h-4 w-4" />
            </span>
          </button>
        )}

        {type !== 'Date' && type !== 'Checkbox' && field.inserted && !loading && !readOnlyField && (
          <button
            className="text-destructive bg-background/50 absolute inset-0 z-10 flex h-full w-full items-center justify-center rounded-md text-sm opacity-0 duration-200 group-hover:opacity-100"
            onClick={onRemoveSignedFieldClick}
          >
            Remove
          </button>
        )}

        {children}
      </FieldRootContainer>
    </div>
  );
};
