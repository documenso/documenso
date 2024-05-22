'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
  TEMPLATES_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
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
    label: 'ყველა დოკუმენტი',
    path: '/documents?status=ALL',
    shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'დრაფტი დოკუმენტები', path: '/documents?status=DRAFT' },
  {
    label: 'ხელმოწერილი დოკუმენტები',
    path: '/documents?status=COMPLETED',
  },
  { label: 'მომლოდინე დოკუმენტები', path: '/documents?status=PENDING' },
  { label: 'შემოსული დოკუმენტები', path: '/documents?status=INBOX' },
];

const TEMPLATES_PAGES = [
  {
    label: 'ყველა შაბლონი',
    path: '/templates',
    shortcut: TEMPLATES_PAGE_SHORTCUT.replace('+', ''),
  },
];

const SETTINGS_PAGES = [
  {
    label: 'პარამეტრები',
    path: '/settings',
    shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: 'პროფილი', path: '/settings/profile' },
  { label: 'პაროლი', path: '/settings/password' },
];

export type CommandMenuProps = {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
};

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { setTheme } = useTheme();

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
        // Do not batch this due to relatively long request time compared to
        // other queries which are generally batched with this.
        ...SKIP_QUERY_BATCH_META,
        ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      },
    );

  const searchResults = useMemo(() => {
    if (!searchDocumentsData) {
      return [];
    }

    return searchDocumentsData.map((document) => ({
      label: document.title,
      path: document.path,
      value: document.value,
    }));
  }, [searchDocumentsData]);

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
      <CommandInput value={search} onValueChange={setSearch} placeholder="მოძებნეთ..." />

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
          <CommandEmpty>შედეგები არ მოიძებნა.</CommandEmpty>
        )}
        {!currentPage && (
          <>
            <CommandGroup className="mx-2 p-0 pb-2" heading="დოკუმენტები">
              <Commands push={push} pages={DOCUMENTS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="შაბლონები">
              <Commands push={push} pages={TEMPLATES_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="პარამეტრები">
              <Commands push={push} pages={SETTINGS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading="პრეფერენციები">
              <CommandItem className="-mx-2 -my-1 rounded-lg" onSelect={() => addPage('theme')}>
                შეცვალეთ ფონი
              </CommandItem>
            </CommandGroup>
            {searchResults.length > 0 && (
              <CommandGroup className="mx-2 p-0 pb-2" heading="თქვენი დოკუმენტები">
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
      { label: 'ნათელი როჟიმი', theme: THEMES_TYPE.LIGHT, icon: Sun },
      { label: 'მუქი რეჟიმი', theme: THEMES_TYPE.DARK, icon: Moon },
      { label: 'სისტემის ფონი', theme: THEMES_TYPE.SYSTEM, icon: Monitor },
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
