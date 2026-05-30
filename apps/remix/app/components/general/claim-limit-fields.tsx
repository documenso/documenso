import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';

import { RateLimitArrayInput } from './rate-limit-array-input';

type ClaimLimitFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  /** e.g. '' for the claim form, 'claims.' for the org admin form. */
  prefix?: string;
  disabled?: boolean;
};

export const ClaimLimitFields = <T extends FieldValues>({
  control,
  prefix = '',
  disabled,
}: ClaimLimitFieldsProps<T>) => {
  const { t } = useLingui();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const name = (key: string) => `${prefix}${key}` as Path<T>;

  const renderQuotaField = (key: string, label: ReactNode, description: ReactNode) => (
    <FormField
      control={control}
      name={name(key)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              disabled={disabled}
              value={field.value === null || field.value === undefined ? '' : field.value}
              placeholder={t`Unlimited`}
              onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderRateLimitField = (key: string, label: ReactNode) => (
    <FormField
      control={control}
      name={name(key)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <RateLimitArrayInput value={field.value ?? []} onChange={field.onChange} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="space-y-4 rounded-md border p-4">
      <FormLabel>
        <Trans>Limits</Trans>
      </FormLabel>

      {renderQuotaField(
        'documentQuota',
        <Trans>Monthly document quota</Trans>,
        <Trans>Empty = Unlimited, 0 = Blocked</Trans>,
      )}
      {renderRateLimitField('documentRateLimits', <Trans>Document rate limits</Trans>)}

      {renderQuotaField(
        'emailQuota',
        <Trans>Monthly email quota</Trans>,
        <Trans>Empty = Unlimited, 0 = Blocked</Trans>,
      )}
      {renderRateLimitField('emailRateLimits', <Trans>Email rate limits</Trans>)}

      {renderQuotaField('apiQuota', <Trans>Monthly API quota</Trans>, <Trans>Empty = Unlimited, 0 = Blocked</Trans>)}
      {renderRateLimitField('apiRateLimits', <Trans>API rate limits</Trans>)}
    </div>
  );
};
