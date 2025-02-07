import React from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { RecipientActionAuth } from '@documenso/lib/types/document-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type RecipientActionAuthSelectProps = SelectProps;

export const RecipientActionAuthSelect = (props: RecipientActionAuthSelectProps) => {
  const { _ } = useLingui();

  return (
    <Select {...props}>
      <SelectTrigger className="bg-background text-muted-foreground">
        <SelectValue placeholder={_(msg`Inherit authentication method`)} />

        <Tooltip>
          <TooltipTrigger className="-mr-1 ml-auto">
            <InfoIcon className="mx-2 h-4 w-4" />
          </TooltipTrigger>

          <TooltipContent className="text-foreground max-w-md p-4">
            <h2>
              <strong>
                <Trans>Recipient action authentication</Trans>
              </strong>
            </h2>

            <p>
              <Trans>The authentication required for recipients to sign fields</Trans>
            </p>

            <p className="mt-2">
              <Trans>This will override any global settings.</Trans>
            </p>

            <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
              <li>
                <Trans>
                  <strong>Inherit authentication method</strong> - Use the global action signing
                  authentication method configured in the "General Settings" step
                </Trans>
              </li>
              {/* <li>
                <strong>Require account</strong> - The recipient must be
                signed in
              </li> */}
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
      </SelectTrigger>

      <SelectContent position="popper">
        {/* Note: -1 is remapped in the Zod schema to the required value. */}
        <SelectItem value="-1">
          <Trans>Inherit authentication method</Trans>
        </SelectItem>

        {Object.values(RecipientActionAuth)
          .filter((auth) => auth !== RecipientActionAuth.ACCOUNT)
          .map((authType) => (
            <SelectItem key={authType} value={authType}>
              {DOCUMENT_AUTH_TYPES[authType].value}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
};
