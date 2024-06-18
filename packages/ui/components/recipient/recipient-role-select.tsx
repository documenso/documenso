'use client';

import React, { forwardRef } from 'react';

import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { RecipientRole } from '@documenso/prisma/client';
import { ROLE_ICONS } from '@documenso/ui/primitives/recipient-role-icons';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type RecipientRoleSelectProps = SelectProps & {
  hideCCRecipients?: boolean;
};

export const RecipientRoleSelect = forwardRef<HTMLButtonElement, RecipientRoleSelectProps>(
  ({ hideCCRecipients, ...props }, ref) => (
    <Select {...props}>
      <SelectTrigger ref={ref} className="bg-background w-[60px]">
        {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
        {ROLE_ICONS[props.value as RecipientRole]}
      </SelectTrigger>

      <SelectContent align="end">
        <SelectItem value={RecipientRole.SIGNER}>
          <div className="flex items-center">
            <div className="flex w-[150px] items-center">
              <span className="mr-2">{ROLE_ICONS[RecipientRole.SIGNER]}</span>
              Needs to sign
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                <p>The recipient is required to sign the document for it to be completed.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </SelectItem>

        <SelectItem value={RecipientRole.APPROVER}>
          <div className="flex items-center">
            <div className="flex w-[150px] items-center">
              <span className="mr-2">{ROLE_ICONS[RecipientRole.APPROVER]}</span>
              Needs to approve
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                <p>The recipient is required to approve the document for it to be completed.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </SelectItem>

        <SelectItem value={RecipientRole.VIEWER}>
          <div className="flex items-center">
            <div className="flex w-[150px] items-center">
              <span className="mr-2">{ROLE_ICONS[RecipientRole.VIEWER]}</span>
              Needs to view
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                <p>The recipient is required to view the document for it to be completed.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </SelectItem>

        {!hideCCRecipients && (
          <SelectItem value={RecipientRole.CC}>
            <div className="flex items-center">
              <div className="flex w-[150px] items-center">
                <span className="mr-2">{ROLE_ICONS[RecipientRole.CC]}</span>
                Receives copy
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="text-foreground z-9999 max-w-md p-4">
                  <p>
                    The recipient is not required to take any action and receives a copy of the
                    document after it is completed.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  ),
);

RecipientRoleSelect.displayName = 'RecipientRoleSelect';
