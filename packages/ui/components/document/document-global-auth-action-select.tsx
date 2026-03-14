import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { DocumentActionAuth, DocumentAuth } from '@documenso/lib/types/document-auth';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export interface DocumentGlobalAuthActionSelectProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const DocumentGlobalAuthActionSelect = ({
  value,
  defaultValue,
  onValueChange,
  disabled,
  placeholder,
}: DocumentGlobalAuthActionSelectProps) => {
  const { _ } = useLingui();

  // Convert auth types to MultiSelect options
  const authOptions: Option[] = [
    {
      value: '-1',
      label: _(msg`No restrictions`),
    },
    ...Object.values(DocumentActionAuth)
      .filter((auth) => auth !== DocumentAuth.ACCOUNT)
      .map((authType) => ({
        value: authType,
        label: _(DOCUMENT_AUTH_TYPES[authType].value),
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
    <MultiSelect
      value={selectedOptions}
      defaultOptions={defaultOptions}
      options={authOptions}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder || _(msg`Select authentication methods`)}
      className="bg-background text-muted-foreground"
      hideClearAllButton={false}
      data-testid="documentActionSelectValue"
    />
  );
};

DocumentGlobalAuthActionSelect.displayName = 'DocumentGlobalAuthActionSelect';

export const DocumentGlobalAuthActionTooltip = () => (
  <Tooltip>
    <TooltipTrigger>
      <InfoIcon className="mx-2 h-4 w-4" />
    </TooltipTrigger>

    <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
      <h2>
        <Trans>Global recipient action authentication</Trans>
      </h2>

      <p>
        <Trans>
          The authentication methods required for recipients to sign the signature field.
        </Trans>
      </p>

      <p>
        <Trans>
          These can be overriden by setting the authentication requirements directly on each
          recipient in the next step. Multiple methods can be selected.
        </Trans>
      </p>

      <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
        <li>
          <Trans>
            <strong>Require passkey</strong> - The recipient must have an account and passkey
            configured via their settings
          </Trans>
        </li>
        <li>
          <Trans>
            <strong>Require 2FA</strong> - The recipient must have an account and 2FA enabled via
            their settings
          </Trans>
        </li>

        <li>
          <Trans>
            <strong>Require password</strong> - The recipient must have an account and password
            configured via their settings, the password will be verified during signing
          </Trans>
        </li>

        <li>
          <Trans>
            <strong>No restrictions</strong> - No authentication required
          </Trans>
        </li>
      </ul>
    </TooltipContent>
  </Tooltip>
);
