'use client';

import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { calculateExpiryDate, formatExpiryDate } from '@documenso/lib/utils/expiry';

import { cn } from '../lib/utils';
import { DurationSelector } from './duration-selector';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form/form';

const ZExpirySettingsSchema = z.object({
  expiryDuration: z
    .object({
      amount: z.number().int().min(1),
      unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']),
    })
    .optional(),
});

export type ExpirySettings = z.infer<typeof ZExpirySettingsSchema>;

export interface ExpirySettingsPickerProps {
  className?: string;
  defaultValues?: Partial<ExpirySettings>;
  disabled?: boolean;
  onValueChange?: (value: ExpirySettings) => void;
  value?: ExpirySettings;
}

export const ExpirySettingsPicker = ({
  className,
  defaultValues = {
    expiryDuration: undefined,
  },
  disabled = false,
  onValueChange,
  value,
}: ExpirySettingsPickerProps) => {
  const form = useForm<ExpirySettings>({
    resolver: zodResolver(ZExpirySettingsSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { watch, setValue, getValues } = form;
  const expiryDuration = watch('expiryDuration');

  const calculatedExpiryDate = React.useMemo(() => {
    if (expiryDuration?.amount && expiryDuration?.unit) {
      return calculateExpiryDate(expiryDuration);
    }
    return null;
  }, [expiryDuration]);

  // Call onValueChange when form values change
  React.useEffect(() => {
    const subscription = watch((value) => {
      if (onValueChange) {
        onValueChange(value as ExpirySettings);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onValueChange]);

  // Keep internal form state in sync when a controlled value is provided
  React.useEffect(() => {
    if (value === undefined) return;

    const current = getValues('expiryDuration');
    const next = value.expiryDuration;

    const amountsDiffer = (current?.amount ?? null) !== (next?.amount ?? null);
    const unitsDiffer = (current?.unit ?? null) !== (next?.unit ?? null);

    if (amountsDiffer || unitsDiffer) {
      setValue('expiryDuration', next, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [value, getValues, setValue]);

  return (
    <div className={cn('space-y-4', className)}>
      <Form {...form}>
        <FormField
          control={form.control}
          name="expiryDuration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Link Expiry</Trans>
              </FormLabel>
              <FormDescription>
                <Trans>Set an expiry duration for signing links (leave empty to disable)</Trans>
              </FormDescription>
              <FormControl>
                <DurationSelector
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                  minAmount={1}
                  maxAmount={365}
                />
              </FormControl>
              {calculatedExpiryDate && (
                <FormDescription>
                  <Trans>Links will expire on: {formatExpiryDate(calculatedExpiryDate)}</Trans>
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </div>
  );
};
