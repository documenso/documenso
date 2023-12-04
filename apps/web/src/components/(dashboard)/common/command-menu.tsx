'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';
import { z } from 'zod';

import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import { trpc } from '@documenso/trpc/react';
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
    label: 'All documents',
    path: '/documents?status=ALL',
    shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'Draft documents', path: '/documents?status=DRAFT' },
  { label: 'Completed documents', path: '/documents?status=COMPLETED' },
  { label: 'Pending documents', path: '/documents?status=PENDING' },
  { label: 'Inbox documents', path: '/documents?status=INBOX' },
];

const SETTINGS_PAGES = [
  { label: 'Settings', path: '/settings', shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', '') },
  { label: 'Profile', path: '/settings/profile' },
  { label: 'Password', path: '/settings/password' },
];

export type CommandMenuProps = {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
};

export const ZSearchForm = z.object({
  user_query: z.string().min(1),
});

export type TSearchForm = z.infer<typeof ZSearchForm>;

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { setTheme } = useTheme();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(() => open ?? false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const currentPage = pages[pages.length - 1];

  const toggleOpen = () => {
    setIsOpen((isOpen) => !isOpen);
    onOpenChange?.(!isOpen);

    if (isOpen) {
      setPages([]);
      setSearch('');
    }
  };

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      onOpenChange?.(open);

      if (!open) {
        setPages([]);
        setSearch('');
      }
    },
    [onOpenChange],
  );

  const push = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router, setOpen],
  );

  const addPage = (page: string) => {
    setPages((pages) => [...pages, page]);
    setSearch('');
  };

  const goToSettings = useCallback(() => push(SETTINGS_PAGES[0].path), [push]);
  const goToDocuments = useCallback(() => push(DOCUMENTS_PAGES[0].path), [push]);

  useHotkeys(['ctrl+k', 'meta+k'], toggleOpen);
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
  const searchForm = useForm<TSearchForm>({
    defaultValues: {
      user_query: '',
    },
    resolver: zodResolver(ZSearchForm),
  });

  const { mutateAsync: runSemSearch, data: runSemSearchData } = trpc.semSearch.run.useMutation();

  const onSearchChange = async (user_query: string) => {
    setSearch(user_query);
    console.log('user_query:', user_query);

    if (user_query.length >= 5) {
      // Define MIN_SEARCH_LENGTH as per your requirement
      try {
        const results = await runSemSearch({ user_query });
        console.log('I AM HERE 2');
        if (results) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
        return results;

        // Handle the search results
        // For example, you can redirect to a results page or update the state to display the results
      } catch (error) {
        // Handle error
      }
    }
  };
  console.log(searchResults);
  return (
    <CommandDialog commandProps={{ onKeyDown: handleKeyDown }} open={open} onOpenChange={setOpen}>
      <CommandInput
        value={search}
        onValueChange={(e) => onSearchChange(e)}
        placeholder="Type a command or search..."
      />

      <CommandList>
        {searchResults && searchResults.length > 0 ? (
          searchResults.map((title, index) => <CommandItem key={index}>{title}</CommandItem>)
        ) : (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!currentPage && (
          <>
            <CommandGroup heading="Documents">
              <Commands push={push} pages={DOCUMENTS_PAGES} />
            </CommandGroup>
            <CommandGroup heading="Settings">
              <Commands push={push} pages={SETTINGS_PAGES} />
            </CommandGroup>
            <CommandGroup heading="Preferences">
              <CommandItem onSelect={() => addPage('theme')}>Change theme</CommandItem>
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
