import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@documenso/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckIcon, ChevronDownIcon, Loader } from 'lucide-react';
import { useState } from 'react';

export type FolderSelectComboboxProps = {
  folders: {
    id: string;
    name: string;
  }[];
  value: string | null;
  onChange: (value: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  contentClassName?: string;
  testId?: string;
};

// cmdk filters on `value`, so the root option uses a sentinel that can never collide with a folder id.
const HOME_FOLDER_VALUE = '__home__';

export const FolderSelectCombobox = ({
  folders,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  contentClassName,
  testId,
}: FolderSelectComboboxProps) => {
  const { t } = useLingui();

  const [open, setOpen] = useState(false);

  const homeLabel = t`Home (No Folder)`;
  const selectedFolder = folders.find((folder) => folder.id === value);

  // The saved folder can be hidden from this user's role. Showing Home here would invite them to
  // "confirm" Home and silently clear a folder someone else chose.
  const isRestrictedFolder = Boolean(value) && !selectedFolder;

  const triggerLabel = selectedFolder?.name ?? (isRestrictedFolder ? t`Restricted folder` : homeLabel);

  const onSelect = (folderId: string | null) => {
    onChange(folderId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background px-3 font-normal"
          disabled={disabled || isLoading}
          data-testid={testId}
        >
          {isLoading ? (
            <Loader className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className={cn('truncate', isRestrictedFolder && 'text-muted-foreground')}>{triggerLabel}</span>
              <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn('z-[1001] w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        side="bottom"
        align="start"
      >
        <Command>
          <CommandInput placeholder={t`Search folders`} />

          <CommandEmpty>
            <Trans>No folders found.</Trans>
          </CommandEmpty>

          <CommandGroup className="max-h-[250px] overflow-y-auto">
            <CommandItem value={HOME_FOLDER_VALUE} keywords={[homeLabel]} onSelect={() => onSelect(null)}>
              <CheckIcon className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
              {homeLabel}
            </CommandItem>

            {folders.map((folder) => (
              <CommandItem
                key={folder.id}
                value={folder.id}
                keywords={[folder.name]}
                onSelect={() => onSelect(folder.id)}
              >
                <CheckIcon
                  className={cn('mr-2 h-4 w-4', folder.id === selectedFolder?.id ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{folder.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
