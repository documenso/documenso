import React from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export interface DocumentGlobalAuthAccessSelectProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const DocumentGlobalAuthAccessSelect = ({
  value,
  defaultValue,
  onValueChange,
  disabled,
  placeholder,
}: DocumentGlobalAuthAccessSelectProps) => {
  const { _ } = useLingui();

  // Convert auth types to MultiSelect options
  const authOptions: Option[] = [
    {
      value: '-1',
      label: _(msg`No restrictions`),
    },
    ...Object.values(DocumentAccessAuth).map((authType) => ({
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
    <MultiSelect
      value={selectedOptions}
      defaultOptions={defaultOptions}
      options={authOptions}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder || _(msg`Select access methods`)}
      className="bg-background text-muted-foreground"
      hideClearAllButton={false}
      data-testid="documentAccessSelectValue"
    />
  );
};

DocumentGlobalAuthAccessSelect.displayName = 'DocumentGlobalAuthAccessSelect';

export const DocumentGlobalAuthAccessTooltip = () => (
  <Tooltip>
    <TooltipTrigger>
      <InfoIcon className="mx-2 h-4 w-4" />
    </TooltipTrigger>

    <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
      <h2>
        <strong>
          <Trans>Document access</Trans>
        </strong>
      </h2>

      <p>
        <Trans>The authentication methods required for recipients to view the document.</Trans>
      </p>

      <p className="mt-2">
        <Trans>Multiple access methods can be selected.</Trans>
      </p>

      <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
        <li>
          <Trans>
            <strong>Require account</strong> - The recipient must be signed in to view the document
          </Trans>
        </li>
        <li>
          <Trans>
            <strong>No restrictions</strong> - The document can be accessed directly by the URL sent
            to the recipient
          </Trans>
        </li>
      </ul>
    </TooltipContent>
  </Tooltip>
);
