import { useCallback, useMemo, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CheckIcon, Loader, Monitor, Moon, Sun } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router';
import { Theme, useTheme } from 'remix-themes';

import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
  TEMPLATES_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@documenso/ui/primitives/command';
import { useToast } from '@documenso/ui/primitives/use-toast';

const DOCUMENTS_PAGES = [
  {
    label: msg`All documents`,
    path: '/documents?status=ALL',
    shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: msg`Draft documents`, path: '/documents?status=DRAFT' },
  {
    label: msg`Completed documents`,
    path: '/documents?status=COMPLETED',
  },
  { label: msg`Pending documents`, path: '/documents?status=PENDING' },
  { label: msg`Inbox documents`, path: '/documents?status=INBOX' },
];

const TEMPLATES_PAGES = [
  {
    label: msg`All templates`,
    path: '/templates',
    shortcut: TEMPLATES_PAGE_SHORTCUT.replace('+', ''),
  },
];

const SETTINGS_PAGES = [
  {
    label: msg`Settings`,
    path: '/settings',
    shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', ''),
  },
  { label: msg`Profile`, path: '/settings/profile' },
  { label: msg`Password`, path: '/settings/password' },
];

export type AppCommandMenuProps = {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
};

export function AppCommandMenu({ open, onOpenChange }: AppCommandMenuProps) {
  const { _ } = useLingui();

  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(() => open ?? false);
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState<string[]>([]);

  const { data: searchDocumentsData, isPending: isSearchingDocuments } =
    trpcReact.document.searchDocuments.useQuery(
      {
        query: search,
      },
      {
        placeholderData: (previousData) => previousData,
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
      void navigate(path);
      setOpen(false);
    },
    [setOpen],
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
        placeholder={_(msg`Type a command or search...`)}
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
          <CommandEmpty>
            <Trans>No results found.</Trans>
          </CommandEmpty>
        )}
        {!currentPage && (
          <>
            <CommandGroup className="mx-2 p-0 pb-2" heading={_(msg`Documents`)}>
              <Commands push={push} pages={DOCUMENTS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading={_(msg`Templates`)}>
              <Commands push={push} pages={TEMPLATES_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading={_(msg`Settings`)}>
              <Commands push={push} pages={SETTINGS_PAGES} />
            </CommandGroup>
            <CommandGroup className="mx-2 p-0 pb-2" heading={_(msg`Preferences`)}>
              <CommandItem className="-mx-2 -my-1 rounded-lg" onSelect={() => addPage('language')}>
                Change language
              </CommandItem>
              <CommandItem className="-mx-2 -my-1 rounded-lg" onSelect={() => addPage('theme')}>
                Change theme
              </CommandItem>
            </CommandGroup>
            {searchResults.length > 0 && (
              <CommandGroup className="mx-2 p-0 pb-2" heading={_(msg`Your documents`)}>
                <Commands push={push} pages={searchResults} />
              </CommandGroup>
            )}
          </>
        )}

        {currentPage === 'theme' && <ThemeCommands />}
        {currentPage === 'language' && <LanguageCommands />}
      </CommandList>
    </CommandDialog>
  );
}

const Commands = ({
  push,
  pages,
}: {
  push: (_path: string) => void;
  pages: { label: MessageDescriptor | string; path: string; shortcut?: string; value?: string }[];
}) => {
  const { _ } = useLingui();

  return pages.map((page, idx) => (
    <CommandItem
      className="-mx-2 -my-1 rounded-lg"
      key={page.path + idx}
      value={page.value ?? (typeof page.label === 'string' ? page.label : _(page.label))}
      onSelect={() => push(page.path)}
    >
      {typeof page.label === 'string' ? page.label : _(page.label)}
      {page.shortcut && <CommandShortcut>{page.shortcut}</CommandShortcut>}
    </CommandItem>
  ));
};

const ThemeCommands = () => {
  const { _ } = useLingui();

  const [, setTheme] = useTheme();

  const themes = [
    { label: msg`Light Mode`, theme: Theme.LIGHT, icon: Sun },
    { label: msg`Dark Mode`, theme: Theme.DARK, icon: Moon },
    { label: msg`System Theme`, theme: null, icon: Monitor },
  ] as const;

  return themes.map((theme) => (
    <CommandItem
      key={theme.theme}
      onSelect={() => setTheme(theme.theme)}
      className="-my-1 mx-2 rounded-lg first:mt-2 last:mb-2"
    >
      <theme.icon className="mr-2" />
      {_(theme.label)}
    </CommandItem>
  ));
};

const LanguageCommands = () => {
  const { i18n, _ } = useLingui();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const setLanguage = async (lang: string) => {
    if (isLoading || lang === i18n.locale) {
      return;
    }

    setIsLoading(true);

    try {
      await dynamicActivate(lang);

      const formData = new FormData();

      formData.append('lang', lang);

      const response = await fetch('/api/locale', {
        method: 'post',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }
    } catch (e) {
      console.error(`Failed to set language: ${e}`);

      toast({
        title: _(msg`An unknown error occurred`),
        variant: 'destructive',
        description: _(msg`Unable to change the language at this time. Please try again later.`),
      });
    }

    setIsLoading(false);
  };

  return Object.values(SUPPORTED_LANGUAGES).map((language) => (
    <CommandItem
      disabled={isLoading}
      key={language.full}
      onSelect={async () => setLanguage(language.short)}
      className="-my-1 mx-2 rounded-lg first:mt-2 last:mb-2"
    >
      <CheckIcon
        className={cn('mr-2 h-4 w-4', i18n.locale === language.short ? 'opacity-100' : 'opacity-0')}
      />

      {language.full}
    </CommandItem>
  ));
};
