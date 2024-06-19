'use client';

import React, { forwardRef } from 'react';

import type { SelectProps } from '@radix-ui/react-select';
import { InfoIcon } from 'lucide-react';

import { RecipientRole } from '@documenso/prisma/client';
import { ROLE_ICONS } from '@documenso/ui/primitives/recipient-role-icons';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@documenso/ui/primitives/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

export type RecipientRoleSelectProps = SelectProps;

export const RecipientRoleSelect = forwardRef<HTMLButtonElement, SelectProps>((props, ref) => (
  <Select {...props}>
    <SelectTrigger ref={ref} className="bg-background w-[60px]">
      {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
      {ROLE_ICONS[props.value as RecipientRole]}
    </SelectTrigger>

    <SelectContent align="end">
      <SelectItem value={RecipientRole.SIGNER}>
        <div className="flex w-96 items-center justify-between">
          <div className="flex w-full items-center justify-between  ">
            {/* w-[150px] */}
            მიმღებმა
            <span className="mr-2 flex items-center gap-x-2">
              {ROLE_ICONS[RecipientRole.SIGNER]}საჭიროა ხელი მოაწეროს
            </span>
            {/* Needs to sign */}
          </div>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="text-foreground z-9999 max-w-md p-4">
              <p>მიმღები ვალდებულია ხელი მოაწეროს დოკუმენტს.</p>
              {/* <p>The recipient is required to sign the document for it to be completed.</p> */}
            </TooltipContent>
          </Tooltip>
        </div>
      </SelectItem>

      <SelectItem value={RecipientRole.APPROVER}>
        <div className="flex w-96 items-center justify-between">
          <div className="flex  w-full w-full items-center justify-between">
            {/* w-[150px] */}
            მიმღებმა{' '}
            <span className="mr-2 flex items-center gap-x-2">
              {ROLE_ICONS[RecipientRole.APPROVER]} საჭიროა დაამტკიცოს
            </span>
            {/* Needs to approve */}
          </div>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="text-foreground z-9999 max-w-md p-4">
              <p>მიმღები ვალდებულია დაამტკიცოს დოკუმენტი.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SelectItem>

      <SelectItem value={RecipientRole.VIEWER}>
        <div className="flex w-96 items-center justify-between">
          <div className="flex  w-full items-center justify-between">
            {/* w-[150px] */}
            მიმღებმა{' '}
            <span className="mr-2 flex items-center gap-x-2">
              {ROLE_ICONS[RecipientRole.VIEWER]} საჭიროა იხილოს
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="text-foreground z-9999 max-w-md p-4">
              <p>მიმღები ვალდებულია ნახოს დოკუმენტი.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SelectItem>

      <SelectItem value={RecipientRole.CC}>
        <div className="flex w-96 items-center justify-between">
          <div className="flex  w-full items-center justify-between">
            {/* w-[150px] */}
            მიმღები{' '}
            <span className="mr-2 flex items-center gap-x-2">
              {ROLE_ICONS[RecipientRole.CC]} იღებს ასლს
            </span>
            {/* Receives copy */}
          </div>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="text-foreground z-9999 max-w-md p-4">
              <p>
                მიმღებს არ მოეთხოვება რაიმე ქმედება და იღებს დოკუმენტის ასლს მისი სრულად ხელმოწერის
                შემდეგ.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
));

RecipientRoleSelect.displayName = 'RecipientRoleSelect';
