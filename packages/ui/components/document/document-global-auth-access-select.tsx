'use client';

import React, { forwardRef } from 'react';

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
  (props, ref) => (
    <Select {...props}>
      <SelectTrigger ref={ref} className="bg-background text-muted-foreground">
        <SelectValue data-testid="documentAccessSelectValue" placeholder="ყველას" />
      </SelectTrigger>

      <SelectContent position="popper">
        {Object.values(DocumentAccessAuth).map((authType) => (
          <SelectItem key={authType} value={authType}>
            {DOCUMENT_AUTH_TYPES[authType].value}
          </SelectItem>
        ))}

        {/* Note: -1 is remapped in the Zod schema to the required value. */}
        <SelectItem value={'-1'}>ყველას</SelectItem>
      </SelectContent>
    </Select>
  ),
);

DocumentGlobalAuthAccessSelect.displayName = 'DocumentGlobalAuthAccessSelect';

export const DocumentGlobalAuthAccessTooltip = () => (
  <Tooltip>
    <TooltipTrigger>
      <InfoIcon className="mx-2 h-4 w-4" />
    </TooltipTrigger>

    <TooltipContent className="text-foreground max-w-md space-y-2 p-4">
      <h2>
        <strong>დოკუმენტზე წვდომა</strong>
      </h2>

      <p>მიმღებებს ავტორიზაცია უნდა ჰქონდეთ გავლილი ამ დოკუმენტის სანახავად.</p>

      <ul className="ml-3.5 list-outside list-disc space-y-0.5 py-2">
        <li>
          <strong>ავტორიზებულ პირს</strong> - მიმღებს ავტორიზაცია უნდა ჰქონდეს გავლილი ამ დოკუმენტის
          სანახავად
        </li>
        <li>
          <strong>ყველას</strong> - ამ დოკუმენტის სანახავად მიმღებისთვის ავტორიზაციის გავლა საჭირო
          არ არის
        </li>
      </ul>
    </TooltipContent>
  </Tooltip>
);
