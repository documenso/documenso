import React, { forwardRef } from 'react';

import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TemplateType } from '@prisma/client';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type TemplateTypeSelectProps = SelectProps;

export const TemplateTypeSelect = forwardRef<HTMLButtonElement, TemplateTypeSelectProps>(
  ({ ...props }, ref) => {
    useLingui();

    return (
      <Select {...props}>
        <SelectTrigger ref={ref} className="bg-background">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={TemplateType.PRIVATE}>{t`Private`}</SelectItem>
          <SelectItem value={TemplateType.PUBLIC}>{t`Public`}</SelectItem>
          <SelectItem value={TemplateType.ORGANISATION}>{t`Organisation`}</SelectItem>
        </SelectContent>
      </Select>
    );
  },
);

TemplateTypeSelect.displayName = 'TemplateTypeSelect';

export const TemplateTypeTooltip = ({
  organisationTeamCount,
}: {
  organisationTeamCount: number;
}) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <InfoIcon className="mx-2 h-4 w-4" />
      </TooltipTrigger>

      <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
        <p>
          <Trans>
            <strong>Private</strong> templates can only be used by your team.
          </Trans>
        </p>
        <p>
          <Trans>
            <strong>Public</strong> templates are linked to your public profile.
          </Trans>
        </p>
        {organisationTeamCount >= 2 && (
          <p>
            <Trans>
              <strong>Organisation</strong> templates are shared across all teams in your
              organisation but can only be edited by the owning team.
            </Trans>
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};
