import React from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { RecipientActionAuth } from '@documenso/lib/types/document-auth';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { cn } from '../../lib/utils';

export interface RecipientActionAuthSelectProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const RecipientActionAuthSelect = ({
  value,
  defaultValue,
  onValueChange,
  disabled,
  placeholder,
}: RecipientActionAuthSelectProps) => {
  const { _ } = useLingui();

  // Convert auth types to MultiSelect options
  const authOptions: Option[] = [
    {
      value: '-1',
      label: _(msg`Inherit authentication method`),
    },
    ...Object.values(RecipientActionAuth)
      .filter((auth) => auth !== RecipientActionAuth.ACCOUNT)
      .map((authType) => ({
        value: authType,
        label: DOCUMENT_AUTH_TYPES[authType].value,
      })),
  ];

  // Convert string array to Option array for MultiSelect
  const selectedOptions =
    (value
      ?.map((val) => authOptions.find((option) => option.value === val))
      .filter(Boolean) as Option[]) || [];

  // Convert default value to Option array
  const defaultOptions =
    (defaultValue
      ?.map((val) => authOptions.find((option) => option.value === val))
      .filter(Boolean) as Option[]) || [];

  const handleChange = (options: Option[]) => {
    const values = options.map((option) => option.value);
    onValueChange?.(values);
  };

  return (
    <div className="relative">
      <MultiSelect
        value={selectedOptions}
        defaultOptions={defaultOptions}
        options={authOptions}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder || _(msg`Select authentication methods`)}
        className="bg-background text-muted-foreground"
        maxSelected={4} // Allow selecting up to 4 auth methods
        hideClearAllButton={false}
      />

      <Tooltip>
        <TooltipTrigger
          className={cn('absolute right-2 top-1/2 -translate-y-1/2', {
            'right-8': selectedOptions.length > 0,
          })}
        >
          <InfoIcon className="h-4 w-4" />
        </TooltipTrigger>

        <TooltipContent className="text-foreground max-w-md p-4">
          <h2>
            <strong>
              <Trans>Recipient action authentication</Trans>
            </strong>
          </h2>

          <p>
            <Trans>The authentication methods required for recipients to sign fields</Trans>
          </p>

          <p className="mt-2">
            <Trans>
              These will override any global settings. Multiple methods can be selected.
            </Trans>
          </p>

          <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
            <li>
              <Trans>
                <strong>Inherit authentication method</strong> - Use the global action signing
                authentication method configured in the "General Settings" step
              </Trans>
            </li>
            <li>
              <Trans>
                <strong>Require passkey</strong> - The recipient must have an account and passkey
                configured via their settings
              </Trans>
            </li>
            <li>
              <Trans>
                <strong>Require 2FA</strong> - The recipient must have an account and 2FA enabled
                via their settings
              </Trans>
            </li>
            <li>
              <Trans>
                <strong>None</strong> - No authentication required
              </Trans>
            </li>
          </ul>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
