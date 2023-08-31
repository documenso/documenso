'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@documenso/ui/primitives/command';

export function CommandMenu() {
  const { setTheme } = useTheme();
  const { push } = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const page = pages[pages.length - 1];

  useHotkeys('ctrl+k', (e) => {
    e.preventDefault();
    setOpen((open) => !open);
  });
  useHotkeys('n+s', () => push('/settings'));
  useHotkeys('n+d', () => push('/documents?status=ALL'));

  return (
    <CommandDialog
      commandProps={{
        onKeyDown: (e) => {
          // Escape goes to previous page
          // Backspace goes to previous page when search is empty
          if (e.key === 'Escape' || (e.key === 'Backspace' && !search)) {
            e.preventDefault();
            setPages((pages) => pages.slice(0, -1));
          }
        },
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Type a command or search..."
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {!page && (
          <>
            <CommandGroup heading="Documents">
              <CommandItem onSelect={() => push('/documents?status=ALL')}>
                All documents
                <CommandShortcut>ND</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => push('/documents?status=DRAFT')}>
                Draft documents
              </CommandItem>
              <CommandItem onSelect={() => push('/documents?status=COMPLETED')}>
                Completed documents
              </CommandItem>
              <CommandItem onSelect={() => push('/documents?status=PENDING')}>
                Pending documents
              </CommandItem>
              <CommandItem onSelect={() => push('/documents?status=INBOX')}>
                Inbox documents
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem onSelect={() => push('/settings')}>
                Settings
                <CommandShortcut>NS</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => push('/settings/profile')}>Profile</CommandItem>
              <CommandItem onSelect={() => push('/settings/password')}>Password</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Preferences">
              <CommandItem onSelect={() => setPages([...pages, 'theme'])}>Change theme</CommandItem>
            </CommandGroup>
          </>
        )}
        {page === 'theme' && (
          <>
            <CommandItem onSelect={() => setTheme('light')}>
              <Sun className="mr-2" />
              Light Mode
            </CommandItem>

            <CommandItem onSelect={() => setTheme('dark')}>
              <Moon className="mr-2" />
              Dark Mode
            </CommandItem>

            <CommandItem onSelect={() => setTheme('system')}>
              <Monitor className="mr-2" />
              System Theme
            </CommandItem>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
