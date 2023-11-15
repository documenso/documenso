'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@documenso/ui/primitives/command';

const DOCUMENTS_PAGES = [
  {
    label: 'Documents',
    path: '/fr/documents?status=ALL',
    shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'Brouillon', path: '/fr/documents?status=DRAFT' },
  { label: 'Signé', path: '/fr/documents?status=COMPLETED' },
  { label: 'En Attente', path: '/fr/documents?status=PENDING' },
  { label: 'Inbox', path: '/fr/documents?status=INBOX' },
];

const SETTINGS_PAGES = [
  { label: 'Réglages', path: '/fr/settings', shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', '') },
  { label: 'Profile', path: '/fr/settings/profile' },
  { label: 'Mot de Passe', path: '/fr/settings/password' },
];

export function CommandMenu() {
  const { setTheme } = useTheme();
  const { push } = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const currentPage = pages[pages.length - 1];

  const toggleOpen = () => {
    setOpen((open) => !open);
  };

  const goToSettings = useCallback(() => push(SETTINGS_PAGES[0].path), [push]);
  const goToDocuments = useCallback(() => push(DOCUMENTS_PAGES[0].path), [push]);

  useHotkeys('ctrl+k', toggleOpen);
  useHotkeys(SETTINGS_PAGE_SHORTCUT, goToSettings);
  useHotkeys(DOCUMENTS_PAGE_SHORTCUT, goToDocuments);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape goes to previous page
    // Backspace goes to previous page when search is empty
    if (e.key === 'Escape' || (e.key === 'Backspace' && !search)) {
      e.preventDefault();
      if (currentPage === undefined) {
        setOpen(false);
      }
      setPages((pages) => pages.slice(0, -1));
    }
  };

  return (
    <CommandDialog commandProps={{ onKeyDown: handleKeyDown }} open={open} onOpenChange={setOpen}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Type a command or search..."
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {!currentPage && (
          <>
            <CommandGroup heading="Documents">
              <Commands push={push} pages={DOCUMENTS_PAGES} />
            </CommandGroup>
            <CommandGroup heading="Settings">
              <Commands push={push} pages={SETTINGS_PAGES} />
            </CommandGroup>
            <CommandGroup heading="Preferences">
              <CommandItem onSelect={() => setPages([...pages, 'theme'])}>Change theme</CommandItem>
            </CommandGroup>
          </>
        )}
        {currentPage === 'theme' && <ThemeCommands setTheme={setTheme} />}
      </CommandList>
    </CommandDialog>
  );
}

const Commands = ({
  push,
  pages,
}: {
  push: (_path: string) => void;
  pages: { label: string; path: string; shortcut?: string }[];
}) => {
  return pages.map((page) => (
    <CommandItem key={page.path} onSelect={() => push(page.path)}>
      {page.label}
      {page.shortcut && <CommandShortcut>{page.shortcut}</CommandShortcut>}
    </CommandItem>
  ));
};

const ThemeCommands = ({ setTheme }: { setTheme: (_theme: string) => void }) => {
  const THEMES = useMemo(
    () => [
      { label: 'Light Mode', theme: 'light', icon: Sun },
      { label: 'Dark Mode', theme: 'dark', icon: Moon },
      { label: 'System Theme', theme: 'system', icon: Monitor },
    ],
    [],
  );

  return THEMES.map((theme) => (
    <CommandItem key={theme.theme} onSelect={() => setTheme(theme.theme)}>
      <theme.icon className="mr-2" />
      {theme.label}
    </CommandItem>
  ));
};
