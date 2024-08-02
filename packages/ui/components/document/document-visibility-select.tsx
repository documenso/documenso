import React, { forwardRef } from 'react';

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
  currentMemberRole?: string;
};

export const DocumentVisibilitySelect = forwardRef<HTMLButtonElement, DocumentVisibilitySelectType>(
  ({ currentMemberRole, ...props }, ref) => {
    const canUpdateVisibility = currentMemberRole === 'ADMIN' || currentMemberRole === 'MANAGER';

    return (
      <Select {...props} disabled={!canUpdateVisibility}>
        <SelectTrigger ref={ref} className="bg-background text-muted-foreground">
          <SelectValue data-testid="documentVisibilitySelectValue" placeholder="Everyone" />
        </SelectTrigger>

        <SelectContent position="popper">
          {Object.keys(DocumentVisibility)
            .filter((key) => {
              if (props.value?.toString() === key) return true;
              switch (currentMemberRole) {
                case 'ADMIN':
                  return true;
                case 'MANAGER':
                  return key !== DocumentVisibility.ADMIN;
                case 'MEMBER':
                  return key === DocumentVisibility.EVERYONE;
                default:
                  return false;
              }
            })
            .map((key) => (
              <SelectItem key={key} value={key}>
                {DOCUMENT_VISIBILITY[key].value}
              </SelectItem>
            ))}
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
          <strong>Document visibility</strong>
        </h2>

        <p>The visibility of the document to the recipient.</p>

        <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
          <li>
            <strong>Everyone</strong> - Everyone can access and view the document
          </li>
          <li>
            <strong>Managers and above</strong> - Only managers and above can access and view the
            document
          </li>
          <li>
            <strong>Admins only</strong> - Only admins can access and view the document
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
