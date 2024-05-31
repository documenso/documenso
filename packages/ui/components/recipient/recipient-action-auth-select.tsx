'use client';

import React from 'react';

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
  return (
    <Select {...props}>
      <SelectTrigger className="bg-background text-muted-foreground">
        <SelectValue placeholder="Inherit authentication method" />

        <Tooltip>
          <TooltipTrigger className="-mr-1 ml-auto">
            <InfoIcon className="mx-2 h-4 w-4" />
          </TooltipTrigger>

          <TooltipContent className="text-foreground max-w-md p-4">
            <h2>
              <strong>მიმღების პარამეტრების ავთენტიფიკაცია</strong>
              {/*ჩემი <strong>Recipient action authentication</strong> */}
            </h2>

            <p>ველებზე ხელმოწერისთვის საჭიროა ავთენტიფიკაცია.</p>

            <p className="mt-2">ეს უარყოფს ნებისმიერ გლობალურ პარამეტრს.</p>

            <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
              <li>
                <strong>გამოიყენეთ აუთენტიფიკაციის მეთოდი</strong> - გამოიყენეთ მიმღების გლობალური
                პარამეტრების ავთენტიფიკაციის მეთოდი, რომელიც კონფიგურებულია "ზოგადი პარამეტრების"
                ეტაპზე
              </li>
              {/* ჩემი <li>
                <strong>Inherit authentication method</strong> - Use the global action signing
                authentication method configured in the "General Settings" step
              </li> */}
              {/* <li>
                <strong>Require account</strong> - The recipient must be
                signed in
              </li> */}
              <li>
                <strong>მოითხოვეთ საიდუმლო გასაღები</strong> - მიმღებს უნდა ჰქონდეს ანგარიში და
                კონფიგურირებული საიდუმლო გასაღები მათი პარამეტრების მეშვეობით
              </li>
              <li>
                <strong>მოითხოვეთ 2FA</strong> - მიმღებს უნდა ჰქონდეს ანგარიში და 2FA ჩართული მისი
                პარამეტრების მეშვეობით
              </li>
              <li>
                <strong>არანაირი</strong> - ავთენტიფიკაცია საჭირო არ არის
              </li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </SelectTrigger>

      <SelectContent position="popper">
        {/* Note: -1 is remapped in the Zod schema to the required value. */}
        <SelectItem value="-1">გამოიყენეთ აუთენტიფიკაციის მეთოდი</SelectItem>
        {/* <SelectItem value="-1">Inherit authentication method</SelectItem> */}

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
