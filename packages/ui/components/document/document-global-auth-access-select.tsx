import { forwardRef } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_AUTH_TYPES } from '@documenso/lib/constants/document-auth';
import { DocumentAccessAuth } from '@documenso/lib/types/document-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export const DocumentGlobalAuthAccessSelect = forwardRef<HTMLButtonElement, SelectProps>(
  (props, ref) => {
    const { _ } = useLingui();

    return (
      <Select {...props}>
        <SelectTrigger ref={ref} className="bg-background text-muted-foreground">
          <SelectValue
            data-testid="documentAccessSelectValue"
            placeholder={_(msg`No restrictions`)}
          />
        </SelectTrigger>

        <SelectContent position="popper">
          {/* Note: -1 is remapped in the Zod schema to the required value. */}
          <SelectItem value={'-1'}>
            <Trans>No restrictions</Trans>
          </SelectItem>

          {Object.values(DocumentAccessAuth).map((authType) => (
            <SelectItem key={authType} value={authType}>
              {DOCUMENT_AUTH_TYPES[authType].value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);

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
        <Trans>The authentication required for recipients to view the document.</Trans>
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
