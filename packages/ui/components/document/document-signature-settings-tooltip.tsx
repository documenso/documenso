import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export const DocumentSignatureSettingsTooltip = () => {
  return (
    <Tooltip>
      <TooltipTrigger type="button">
        <InfoIcon className="mx-2 h-4 w-4" />
      </TooltipTrigger>

      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
        <h2>
          <strong>
            <Trans>Signature types</Trans>
          </strong>
        </h2>

        <p>
          <Trans>
            The types of signatures that recipients are allowed to use when signing the document.
          </Trans>
        </p>

        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
          <li>
            <Trans>
              <strong>
                <Trans>Drawn</Trans>
              </strong>
              {' - '}
              <Trans>A signature that is drawn using a mouse or stylus.</Trans>
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>
                <Trans>Typed</Trans>
              </strong>
              {' - '}
              <Trans>A signature that is typed using a keyboard.</Trans>
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>
                <Trans>Uploaded</Trans>
              </strong>
              {' - '}
              <Trans>A signature that is uploaded from a file.</Trans>
            </Trans>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
