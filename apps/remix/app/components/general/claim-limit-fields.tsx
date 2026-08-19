import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';

import { RateLimitArrayInput } from './rate-limit-array-input';

/**
 * The rate-limit editor renders its own per-row inline errors, but a submit
 * attempt can still surface array-level Zod issues (e.g. a committed duplicate
 * window). Rendering the field's message here guarantees the form never fails
 * silently when those errors are not tied to a row the editor is showing.
 */

type ClaimLimitFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  /** e.g. '' for the claim form, 'claims.' for the org admin form. */
  prefix?: string;
  disabled?: boolean;
};

type LimitGroup = {
  title: ReactNode;
  quotaKey: string;
  rateLimitKey: string;
};

export const ClaimLimitFields = <T extends FieldValues>({
  control,
  prefix = '',
  disabled,
}: ClaimLimitFieldsProps<T>) => {
  const { t } = useLingui();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const name = (key: string) => `${prefix}${key}` as Path<T>;

  const limitGroups: LimitGroup[] = [
    {
      title: <Trans>Documents</Trans>,
      quotaKey: 'documentQuota',
      rateLimitKey: 'documentRateLimits',
    },
    {
      title: <Trans>Emails</Trans>,
      quotaKey: 'emailQuota',
      rateLimitKey: 'emailRateLimits',
    },
    {
      title: <Trans>API</Trans>,
      quotaKey: 'apiQuota',
      rateLimitKey: 'apiRateLimits',
    },
  ];

  const renderQuotaField = (group: LimitGroup) => (
    <FormField
      control={control}
      name={name(group.quotaKey)}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-muted-foreground text-xs">
            <Trans>Monthly quota</Trans>
          </FormLabel>
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
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const renderRateLimitField = (group: LimitGroup) => (
    <FormField
      control={control}
      name={name(group.rateLimitKey)}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <RateLimitArrayInput value={field.value ?? []} onChange={field.onChange} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-base">
          <Trans>Limits</Trans>
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          <Trans>
            Empty quota means unlimited, 0 blocks the resource. Rate limit windows accept values like 5m, 1h or 24h.
          </Trans>
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {limitGroups.map((group) => (
            <div key={group.quotaKey} className="space-y-4 p-4">
              <h4 className="font-semibold text-sm">{group.title}</h4>

              {renderQuotaField(group)}
              {renderRateLimitField(group)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
