import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import {
  DocumentActionAuth,
  DocumentAuth,
  NonEnterpriseDocumentActionAuth,
} from '@documenso/lib/types/document-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export interface DocumentGlobalAuthActionSelectProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isDocumentEnterprise?: boolean;
}

export const DocumentGlobalAuthActionSelect = ({
  value,
  onValueChange,
  disabled,
  placeholder,
  isDocumentEnterprise,
}: DocumentGlobalAuthActionSelectProps) => {
  const { _ } = useLingui();

  const authTypes = isDocumentEnterprise
    ? Object.values(DocumentActionAuth).filter((auth) => auth !== DocumentAuth.ACCOUNT)
    : Object.values(NonEnterpriseDocumentActionAuth).filter(
        (auth) => auth !== DocumentAuth.EXPLICIT_NONE,
      );

  const selectedValue = value?.[0] || '';

  const handleChange = (newValue: string) => {
    if (newValue === '-1') {
      onValueChange?.([]);
    } else {
      onValueChange?.([newValue]);
    }
  };

  return (
    <Select value={selectedValue || '-1'} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger
        className="bg-background text-muted-foreground"
        data-testid="documentActionSelectValue"
      >
        <SelectValue placeholder={placeholder || _(msg`Select authentication method`)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="-1">{_(msg`No restrictions`)}</SelectItem>
        {authTypes.map((authType) => (
          <SelectItem key={authType} value={authType}>
            {DOCUMENT_AUTH_TYPES[authType].value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
          The authentication method required for recipients to sign the signature field.
        </Trans>
      </p>

      <p>
        <Trans>
          This can be overridden by setting the authentication requirements directly on each
          recipient in the next step.
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
