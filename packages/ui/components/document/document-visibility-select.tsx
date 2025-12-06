import React, { forwardRef } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { DOCUMENT_VISIBILITY } from '@documenso/lib/constants/document-visibility';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type DocumentVisibilitySelectType = SelectProps & {
  currentTeamMemberRole?: string;
  isTeamSettings?: boolean;
  disabled?: boolean;
  canUpdateVisibility?: boolean;
};

export const DocumentVisibilitySelect = forwardRef<HTMLButtonElement, DocumentVisibilitySelectType>(
  (
    { currentTeamMemberRole, isTeamSettings = false, disabled, canUpdateVisibility, ...props },
    ref,
  ) => {
    const { t } = useLingui();

    const isAdmin = currentTeamMemberRole === TeamMemberRole.ADMIN;
    const isManager = currentTeamMemberRole === TeamMemberRole.MANAGER;
    const canEdit = isTeamSettings || canUpdateVisibility;

    return (
      <Select {...props} disabled={!canEdit || disabled}>
        <SelectTrigger ref={ref} className="bg-background text-muted-foreground">
          <SelectValue data-testid="documentVisibilitySelectValue" placeholder={t`Everyone`} />
        </SelectTrigger>

        <SelectContent position="popper">
          <SelectItem value={DocumentVisibility.EVERYONE}>
            {DOCUMENT_VISIBILITY.EVERYONE.value}
          </SelectItem>
          <SelectItem
            value={DocumentVisibility.MANAGER_AND_ABOVE}
            disabled={!isAdmin && !isManager}
          >
            {DOCUMENT_VISIBILITY.MANAGER_AND_ABOVE.value}
          </SelectItem>
          <SelectItem value={DocumentVisibility.ADMIN} disabled={!isAdmin}>
            {DOCUMENT_VISIBILITY.ADMIN.value}
          </SelectItem>
        </SelectContent>
      </Select>
    );
  },
);

DocumentVisibilitySelect.displayName = 'DocumentVisibilitySelect';

export const DocumentVisibilityTooltip = () => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <InfoIcon className="mx-2 h-4 w-4" />
      </TooltipTrigger>

      <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
        <h2>
          <strong>
            <Trans>Document visibility</Trans>
          </strong>
        </h2>

        <p>
          <Trans>The visibility of the document to the recipient.</Trans>
        </p>

        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
          <li>
            <Trans>
              <strong>Everyone</strong> - Everyone can access and view the document
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>Managers and above</strong> - Only managers and above can access and view the
              document
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>Admins only</strong> - Only admins can access and view the document
            </Trans>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
