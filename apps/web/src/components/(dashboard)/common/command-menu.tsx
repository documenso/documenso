'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader, Monitor, Moon, Sun } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
  TEMPLATES_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import type { Document, Recipient } from '@documenso/prisma/client';
import { trpc as trpcReact } from '@documenso/trpc/react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@documenso/ui/primitives/command';
import { THEMES_TYPE } from '@documenso/ui/primitives/constants';

const DOCUMENTS_PAGES = [
  {
    label: 'All documents',
    path: '/documents?status=ALL',
    shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'Draft documents', path: '/documents?status=DRAFT' },
  {
    label: 'Completed documents',
    path: '/documents?status=COMPLETED',
  },
  { label: 'Pending documents', path: '/documents?status=PENDING' },
  { label: 'Inbox documents', path: '/documents?status=INBOX' },
];

const TEMPLATES_PAGES = [
  {
    label: 'All templates',
    path: '/templates',
    shortcut: TEMPLATES_PAGE_SHORTCUT.replace('+', ''),
  },
];

const SETTINGS_PAGES = [
  {
    label: 'Settings',
    path: '/settings',
    shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'Profile', path: '/settings/profile' },
  { label: 'Password', path: '/settings/password' },
];

export type CommandMenuProps = {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
};

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { setTheme } = useTheme();
  const { data: session } = useSession();

  const router = useRouter();

  const [isOpen, setIsOpen] = useState(() => open ?? false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<string[]>([]);

  const { data: searchDocumentsData, isLoading: isSearchingDocuments } =
    trpcReact.document.searchDocuments.useQuery(
      {
        query: search,
      },
      {
        keepPreviousData: true,
      },
    );

  const isOwner = useCallback(
    (document: Document) => document.userId === session?.user.id,
    [session?.user.id],
  );

  const getSigningLink = useCallback(
    (recipients: Recipient[]) =>
      `/sign/${recipients.find((r) => r.email === session?.user.email)?.token}`,
    [session?.user.email],
  );

  const searchResults = useMemo(() => {
    if (!searchDocumentsData) {
      return [];
    }

    return searchDocumentsData.map((document) => ({
      label: document.title,
      path: isOwner(document) ? `/documents/${document.id}` : getSigningLink(document.Recipient),
      value: [document.id, document.title, ...document.Recipient.map((r) => r.email)].join(' '),
    }));
  }, [searchDocumentsData, isOwner, getSigningLink]);

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
  const goToTemplates = useCallback(() => push(TEMPLATES_PAGES[0].path), [push]);

  useHotkeys(['ctrl+k', 'meta+k'], toggleOpen, { preventDefault: true });
  useHotkeys(SETTINGS_PAGE_SHORTCUT, goToSettings);
  useHotkeys(DOCUMENTS_PAGE_SHORTCUT, goToDocuments);
  useHotkeys(TEMPLATES_PAGE_SHORTCUT, goToTemplates);

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
    <CommandDialog
      commandProps={{
        onKeyDown: handleKeyDown,
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
        {isSearchingDocuments ? (
          <CommandEmpty>
            <div className="flex items-center justify-center">
              <span className="animate-spin">
                <Loader />
              </span>
            </div>
          </CommandEmpty>
        ) : (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {!currentPage && (
          <>
            <CommandGroup className="mx-2 p-0 pb-2" heading="Documents">
              <Commands push={push} pages={DOCUMENTS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="Templates">
              <Commands push={push} pages={TEMPLATES_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="Settings">
              <Commands push={push} pages={SETTINGS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="Preferences">
              <CommandItem className="-mx-2 -my-1 rounded-lg" onSelect={() => addPage('theme')}>
                Change theme
              </CommandItem>
            </CommandGroup>
            {searchResults.length > 0 && (
              <CommandGroup className="mx-2 p-0 pb-2" heading="Your documents">
                <Commands push={push} pages={searchResults} />
              </CommandGroup>
            )}
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
  pages: { label: string; path: string; shortcut?: string; value?: string }[];
}) => {
  return pages.map((page, idx) => (
    <CommandItem
      className="-mx-2 -my-1 rounded-lg"
      key={page.path + idx}
      value={page.value ?? page.label}
      onSelect={() => push(page.path)}
    >
      {page.label}
      {page.shortcut && <CommandShortcut>{page.shortcut}</CommandShortcut>}
    </CommandItem>
  ));
};

const ThemeCommands = ({ setTheme }: { setTheme: (_theme: string) => void }) => {
  const THEMES = useMemo(
    () => [
      { label: 'Light Mode', theme: THEMES_TYPE.LIGHT, icon: Sun },
      { label: 'Dark Mode', theme: THEMES_TYPE.DARK, icon: Moon },
      { label: 'System Theme', theme: THEMES_TYPE.SYSTEM, icon: Monitor },
    ],
    [],
  );

  return THEMES.map((theme) => (
    <CommandItem
      key={theme.theme}
      onSelect={() => setTheme(theme.theme)}
      className="-my-1 mx-2 rounded-lg first:mt-2 last:mb-2"
    >
      <theme.icon className="mr-2" />
      {theme.label}
    </CommandItem>
  ));
};
