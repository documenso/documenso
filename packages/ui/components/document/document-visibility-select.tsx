import { DOCUMENT_VISIBILITY } from '@documenso/lib/constants/document-visibility';
import { DocumentVisibility } from '@documenso/lib/types/document-visibility';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';
import { forwardRef } from 'react';

export type DocumentVisibilitySelectType = SelectProps & {
  currentTeamMemberRole?: string;
  isTeamSettings?: boolean;
  disabled?: boolean;
  canUpdateVisibility?: boolean;
};

export const DocumentVisibilitySelect = forwardRef<HTMLButtonElement, DocumentVisibilitySelectType>(
  ({ currentTeamMemberRole, isTeamSettings = false, disabled, canUpdateVisibility, ...props }, ref) => {
    const { _ } = useLingui();

    const isAdmin = currentTeamMemberRole === TeamMemberRole.ADMIN;
    const isManager = currentTeamMemberRole === TeamMemberRole.MANAGER;
    const canEdit = isTeamSettings || canUpdateVisibility;

    return (
      <Select {...props} disabled={!canEdit || disabled}>
        <SelectTrigger ref={ref} className="bg-background text-muted-foreground">
          <SelectValue data-testid="documentVisibilitySelectValue" placeholder={t`Everyone`} />
        </SelectTrigger>

        <SelectContent position="popper">
          <SelectItem value={DocumentVisibility.EVERYONE}>{_(DOCUMENT_VISIBILITY.EVERYONE.value)}</SelectItem>
          <SelectItem value={DocumentVisibility.MANAGER_AND_ABOVE} disabled={!isAdmin && !isManager}>
            {_(DOCUMENT_VISIBILITY.MANAGER_AND_ABOVE.value)}
          </SelectItem>
          <SelectItem value={DocumentVisibility.ADMIN} disabled={!isAdmin}>
            {_(DOCUMENT_VISIBILITY.ADMIN.value)}
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

      <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
        <h2>
          <strong>
            <Trans>Document visibility</Trans>
          </strong>
        </h2>

        <p>
          <Trans>
            Controls which team members can view and access this document. The document owner and assigned recipients
            will always have access.
          </Trans>
        </p>

        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
          <li>
            <Trans>
              <strong>Everyone</strong> - Visible to you and all team members.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>Managers and above</strong> - Visible to you and team managers and admins.
            </Trans>
          </li>
          <li>
            <Trans>
              <strong>Admins only</strong> - Visible to you and team admins.
            </Trans>
          </li>
        </ul>

        <p>
          <a
            href="https://docs.documenso.com/docs/users/documents/advanced/document-visibility"
            target="_blank"
            rel="noreferrer"
            className="text-documenso-700 hover:text-documenso-600 hover:underline"
          >
            <Trans>Learn more</Trans>
          </a>
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
