import { forwardRef } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { DocumentActionAuth, DocumentAuth } from '@documenso/lib/types/document-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export const DocumentGlobalAuthActionSelect = forwardRef<HTMLButtonElement, SelectProps>(
  (props, ref) => {
    const { _ } = useLingui();

    return (
      <Select {...props}>
        <SelectTrigger className="bg-background text-muted-foreground">
          <SelectValue
            ref={ref}
            data-testid="documentActionSelectValue"
            placeholder={_(msg`No restrictions`)}
          />
        </SelectTrigger>

        <SelectContent position="popper">
          {/* Note: -1 is remapped in the Zod schema to the required value. */}
          <SelectItem value={'-1'}>
            <Trans>No restrictions</Trans>
          </SelectItem>

          {Object.values(DocumentActionAuth)
            .filter((auth) => auth !== DocumentAuth.ACCOUNT)
            .map((authType) => (
              <SelectItem key={authType} value={authType}>
                {DOCUMENT_AUTH_TYPES[authType].value}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  },
);

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
        <Trans>The authentication required for recipients to sign the signature field.</Trans>
      </p>

      <p>
        <Trans>
          This can be overriden by setting the authentication requirements directly on each
          recipient in the next step.
        </Trans>
      </p>

      <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
        {/* <li>
          <strong>Require account</strong> - The recipient must be signed in
        </li> */}
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
            <strong>No restrictions</strong> - No authentication required
          </Trans>
        </li>
      </ul>
    </TooltipContent>
  </Tooltip>
);
