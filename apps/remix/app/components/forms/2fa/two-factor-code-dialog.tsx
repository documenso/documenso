import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { Trans } from '@lingui/react/macro';
import type React from 'react';
import { useState } from 'react';
import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { z } from 'zod';

/**
 * Schema for forms that accept a two factor code. Compose with `.extend()` or `.merge()`.
 */
export const ZTwoFactorCodeFieldSchema = z.object({
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TTwoFactorCodeFieldSchema = z.infer<typeof ZTwoFactorCodeFieldSchema>;

export const hasTwoFactorCode = (data: TTwoFactorCodeFieldSchema) => !!data.totpCode || !!data.backupCode;

type TwoFactorMethod = 'totp' | 'backup';

export type TwoFactorCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting?: boolean;
  submitLabel: React.ReactNode;

  /**
   * Called when the user submits the code. Typically the parent form's submit handler.
   */
  onSubmit: () => void;
};

/**
 * Collects a TOTP or backup code on top of an existing form, mirroring the
 * sign in and disable 2FA dialogs.
 *
 * Must be rendered inside a `<Form>` whose values include `totpCode` and `backupCode`.
 */
export const TwoFactorCodeDialog = <T extends FieldValues & TTwoFactorCodeFieldSchema>({
  open,
  onOpenChange,
  isSubmitting,
  submitLabel,
  onSubmit,
}: TwoFactorCodeDialogProps) => {
  const form = useFormContext<T>();

  const [method, setMethod] = useState<TwoFactorMethod>('totp');

  const totpCodeName = 'totpCode' as Path<T>;
  const backupCodeName = 'backupCode' as Path<T>;

  const onToggleMethod = () => {
    form.resetField(totpCodeName);
    form.resetField(backupCodeName);

    setMethod((current) => (current === 'totp' ? 'backup' : 'totp'));
  };

  const handleOpenChange = (value: boolean) => {
    if (isSubmitting) {
      return;
    }

    if (!value) {
      form.resetField(totpCodeName);
      form.resetField(backupCodeName);
      setMethod('totp');
    }

    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Two-Factor Authentication</Trans>
          </DialogTitle>

          <DialogDescription>
            {method === 'totp' ? (
              <Trans>Enter the code from your authenticator app to continue.</Trans>
            ) : (
              <Trans>Enter one of your backup codes to continue.</Trans>
            )}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={isSubmitting}>
          {method === 'totp' && (
            <FormField
              control={form.control}
              name={totpCodeName}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PinInput {...field} value={field.value ?? ''} maxLength={6} autoFocus>
                      {Array(6)
                        .fill(null)
                        .map((_, i) => (
                          <PinInputGroup key={i}>
                            <PinInputSlot index={i} />
                          </PinInputGroup>
                        ))}
                    </PinInput>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {method === 'backup' && (
            <FormField
              control={form.control}
              name={backupCodeName}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Backup Code</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="text" autoComplete="off" autoFocus {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={onToggleMethod}>
              {method === 'totp' ? <Trans>Use Backup Code</Trans> : <Trans>Use Authenticator</Trans>}
            </Button>

            <Button type="button" loading={isSubmitting} onClick={onSubmit}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
