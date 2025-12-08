import { useLingui } from '@lingui/react/macro';
import { createCallable } from 'react-call';

import type { TDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';

export type SignFieldDropdownDialogProps = {
  fieldMeta: TDropdownFieldMeta;
};

export const SignFieldDropdownDialog = createCallable<SignFieldDropdownDialogProps, string | null>(
  ({ call, fieldMeta }) => {
    const { t } = useLingui();

    const values = fieldMeta.values?.map((value) => value.value) ?? [];

    return (
      <CommandDialog
        position="start"
        dialogContentClassName="mt-4"
        open={true}
        onOpenChange={(value) => (!value ? call.end(null) : null)}
      >
        <CommandInput placeholder={t`Select an option`} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading={t`Options`}>
            {values.map((value, i) => (
              <CommandItem onSelect={() => call.end(value)} key={i} value={value}>
                {value}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );
  },
);
