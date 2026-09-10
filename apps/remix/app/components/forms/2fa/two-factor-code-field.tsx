import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { Trans } from '@lingui/react/macro';
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

/**
 * Refinement to require a two factor code when the user has 2FA enabled.
 */
export const hasTwoFactorCode = (data: TTwoFactorCodeFieldSchema) => !!data.totpCode || !!data.backupCode;

type TwoFactorMethod = 'totp' | 'backup';

/**
 * A TOTP pin input with a toggle to enter a backup code instead.
 *
 * Must be rendered inside a `<Form>` whose values include `totpCode` and `backupCode`.
 */
export const TwoFactorCodeField = <T extends FieldValues & TTwoFactorCodeFieldSchema>() => {
  const form = useFormContext<T>();

  const [method, setMethod] = useState<TwoFactorMethod>('totp');

  const totpCodeName = 'totpCode' as Path<T>;
  const backupCodeName = 'backupCode' as Path<T>;

  const onToggleMethod = () => {
    form.resetField(totpCodeName);
    form.resetField(backupCodeName);

    setMethod((current) => (current === 'totp' ? 'backup' : 'totp'));
  };

  return (
    <>
      {method === 'totp' && (
        <FormField
          control={form.control}
          name={totpCodeName}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Two factor code</Trans>
              </FormLabel>
              <FormControl>
                <PinInput {...field} value={field.value ?? ''} maxLength={6}>
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
              <FormLabel required>
                <Trans>Backup code</Trans>
              </FormLabel>
              <FormControl>
                <Input type="text" autoComplete="off" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <button
        type="button"
        className="self-start text-muted-foreground text-sm underline hover:text-foreground"
        onClick={onToggleMethod}
      >
        {method === 'totp' ? <Trans>Use a backup code</Trans> : <Trans>Use your authenticator</Trans>}
      </button>
    </>
  );
};
