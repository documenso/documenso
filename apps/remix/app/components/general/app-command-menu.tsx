import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { SUPPORTED_LANGUAGES } from '@documenso/lib/constants/i18n';
import {
  DOCUMENTS_PAGE_SHORTCUT,
  SETTINGS_PAGE_SHORTCUT,
  TEMPLATES_PAGE_SHORTCUT,
} from '@documenso/lib/constants/keyboard-shortcuts';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION, SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { trpc as trpcReact } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@documenso/ui/primitives/command';
import { Dialog, DialogContent } from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { keepPreviousData } from '@tanstack/react-query';
import { commandScore } from 'cmdk/dist/command-score';
import {
  ArrowLeftIcon,
  CheckIcon,
  CornerDownLeftIcon,
  FileTextIcon,
  GlobeIcon,
  KeyRoundIcon,
  LanguagesIcon,
  LayoutTemplateIcon,
  LoaderIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Link, useNavigate } from 'react-router';
import { Theme, useTheme } from 'remix-themes';
import { match } from 'ts-pattern';

import { useOptionalCurrentTeam } from '~/providers/team';

import type { PromptCategory, PromptItem } from './app-command-menu.types';
import { useAdminSearchCategories } from './use-admin-search-categories';

/**
 * The maximum number of results the personal document/template searches return.
 */
const PERSONAL_SEARCH_RESULTS_CAP = 20;

/**
 * The minimum score for a hardcoded item to count as a fuzzy match.
 *
 * Prevents searches like "pass" showing "Templates"
 */
const MIN_FUZZY_SCORE = 0.1;

const PROMPT_GROUP_CLASSNAME =
  'border-0 p-0 pt-1 [&_[cmdk-group-heading]]:mt-0 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:opacity-100';

export type AppCommandMenuProps = {
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
};

export const AppCommandMenu = ({ open, onOpenChange }: AppCommandMenuProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const navigate = useNavigate();
  const currentTeam = useOptionalCurrentTeam();

  const [isOpen, setIsOpen] = useState(() => open ?? false);
  const [search, setSearch] = useState('');
  const [activePage, setActivePage] = useState<'theme' | 'language' | null>(null);
  const [activeChip, setActiveChip] = useState('all');
  const [commandValue, setCommandValue] = useState('');

  // Support both controlled and uncontrolled usage.
  const isPromptOpen = open ?? isOpen;

  const debouncedSearch = useDebouncedValue(search, 200);
  const trimmedSearch = debouncedSearch.trim();

  // cmdk keeps a stale selection value behind when the entire result list is
  // replaced, which prevents it from auto selecting the first new result.
  // Controlling the value and clearing it whenever the query changes makes
  // cmdk reliably select the first item once the new results register.
  useEffect(() => {
    setCommandValue('');
  }, [debouncedSearch, activePage]);

  const hasValidSearch = trimmedSearch.length > 0;

  const {
    data: searchDocumentsData,
    isFetching: isFetchingDocuments,
    isError: isDocumentsSearchError,
  } = trpcReact.document.search.useQuery(
    {
      query: debouncedSearch,
    },
    {
      // Sub pages filter their own local lists, so the searches pause while
      // one is open.
      enabled: isPromptOpen && activePage === null && hasValidSearch,
      placeholderData: keepPreviousData,
      // Show immediate failure instead of a long spinner.
      retry: false,

      // Do not batch this due to relatively long request time compared to
      // other queries which are generally batched with this.
      ...SKIP_QUERY_BATCH_META,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    },
  );

  const {
    data: searchTemplatesData,
    isFetching: isFetchingTemplates,
    isError: isTemplatesSearchError,
  } = trpcReact.template.search.useQuery(
    {
      query: debouncedSearch,
    },
    {
      enabled: isPromptOpen && activePage === null && hasValidSearch,
      placeholderData: keepPreviousData,
      retry: false,
      ...SKIP_QUERY_BATCH_META,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    },
  );

  const {
    isUserAdmin,
    categories: adminSearchCategories,
    isFetching: isFetchingAdminSearch,
    isError: isAdminSearchError,
  } = useAdminSearchCategories({
    query: trimmedSearch,
    open: isPromptOpen && activePage === null,
  });

  // Hide the page scrollbar while the prompt is open. Radix's scroll lock
  // blocks wheel and touch scrolling, but the page scrolls on the root
  // element so its scrollbar stays visible and draggable.
  useEffect(() => {
    if (!isPromptOpen) {
      return;
    }

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    const previousOverflow = document.documentElement.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = 'hidden';

    // Compensate for the removed scrollbar so the page doesn't shift.
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isPromptOpen]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
      onOpenChange?.(nextOpen);

      if (!nextOpen) {
        setActivePage(null);
        setActiveChip('all');
        setSearch('');
        setCommandValue('');
      }
    },
    [onOpenChange],
  );

  const toggleOpen = () => {
    setOpen(!isPromptOpen);
  };

  const push = useCallback(
    (path: string) => {
      void navigate(path);
      setOpen(false);
    },
    [navigate, setOpen],
  );

  const goToPage = useCallback((page: 'theme' | 'language') => {
    setActivePage(page);
    setSearch('');
  }, []);

  const resolveItemLabel = useCallback(
    (label: string | MessageDescriptor) => (typeof label === 'string' ? label : _(label)),
    [_],
  );

  // Fall back to the first available team so the default view always shows
  // the document/template page links, even outside a team context such as the
  // admin pages.
  const teamUrl = useMemo(
    () => currentTeam?.url || organisations[0]?.teams[0]?.url || null,
    [currentTeam, organisations],
  );

  // Fuzzy match and rank the hardcoded items using the same scorer cmdk uses
  // internally, so abbreviations like "setg" still match "Settings".
  const filterBySearch = useCallback(
    (items: PromptItem[]) => {
      if (!hasValidSearch) {
        return items;
      }

      return items
        .map((item) => ({ item, score: commandScore(resolveItemLabel(item.label), trimmedSearch) }))
        .filter(({ score }) => score >= MIN_FUZZY_SCORE)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    },
    [hasValidSearch, trimmedSearch, resolveItemLabel],
  );

  const categories = useMemo(() => {
    const documentPageLinks: PromptItem[] = teamUrl
      ? [
          {
            id: 'documents-all',
            label: msg`All documents`,
            path: `/t/${teamUrl}/documents?status=ALL`,
            icon: FileTextIcon,
            shortcut: DOCUMENTS_PAGE_SHORTCUT.replace('+', ''),
          },
          {
            id: 'documents-draft',
            label: msg`Draft documents`,
            path: `/t/${teamUrl}/documents?status=DRAFT`,
            icon: FileTextIcon,
          },
          {
            id: 'documents-completed',
            label: msg`Completed documents`,
            path: `/t/${teamUrl}/documents?status=COMPLETED`,
            icon: FileTextIcon,
          },
          {
            id: 'documents-pending',
            label: msg`Pending documents`,
            path: `/t/${teamUrl}/documents?status=PENDING`,
            icon: FileTextIcon,
          },
          {
            id: 'documents-inbox',
            label: msg`Inbox documents`,
            path: `/t/${teamUrl}/documents?status=INBOX`,
            icon: FileTextIcon,
          },
        ]
      : [];

    const templatePageLinks: PromptItem[] = teamUrl
      ? [
          {
            id: 'templates-all',
            label: msg`All templates`,
            path: `/t/${teamUrl}/templates`,
            icon: LayoutTemplateIcon,
            shortcut: TEMPLATES_PAGE_SHORTCUT.replace('+', ''),
          },
        ]
      : [];

    const settingsLinks: PromptItem[] = [
      {
        id: 'settings-main',
        label: msg`Settings`,
        path: '/settings',
        icon: SettingsIcon,
        shortcut: SETTINGS_PAGE_SHORTCUT.replace('+', ''),
      },
      { id: 'settings-profile', label: msg`Profile`, path: '/settings/profile', icon: UserIcon },
      { id: 'settings-password', label: msg`Password`, path: '/settings/security', icon: KeyRoundIcon },
      {
        id: 'settings-language',
        label: msg`Change language`,
        icon: LanguagesIcon,
        onAction: () => goToPage('language'),
      },
      { id: 'settings-theme', label: msg`Change theme`, icon: PaletteIcon, onAction: () => goToPage('theme') },
    ];

    const personalDocumentItems: PromptItem[] =
      hasValidSearch && searchDocumentsData
        ? searchDocumentsData.map((document) => ({
            id: `personal-document-${document.path}`,
            label: document.title,
            path: document.path,
            icon: FileTextIcon,
          }))
        : [];

    const personalTemplateItems: PromptItem[] =
      hasValidSearch && searchTemplatesData
        ? searchTemplatesData.map((template) => ({
            id: `personal-template-${template.path}`,
            label: template.title,
            path: template.path,
            icon: LayoutTemplateIcon,
          }))
        : [];

    const documentItems = [...filterBySearch(documentPageLinks), ...personalDocumentItems];

    const templateItems = [...filterBySearch(templatePageLinks), ...personalTemplateItems];

    const settingsItems = filterBySearch(settingsLinks);

    const allCategories: PromptCategory[] = [
      ...adminSearchCategories,
      {
        id: 'documents',
        label: msg`Documents`,
        items: documentItems,
        count: documentItems.length,
        chipCount: personalDocumentItems.length > 0 ? personalDocumentItems.length : null,
        isCapped: personalDocumentItems.length >= PERSONAL_SEARCH_RESULTS_CAP,
        isGlobal: false,
      },
      {
        id: 'templates',
        label: msg`Templates`,
        items: templateItems,
        count: templateItems.length,
        chipCount: personalTemplateItems.length > 0 ? personalTemplateItems.length : null,
        isCapped: personalTemplateItems.length >= PERSONAL_SEARCH_RESULTS_CAP,
        isGlobal: false,
      },
      {
        id: 'settings',
        label: msg`Settings`,
        items: settingsItems,
        count: settingsItems.length,
        chipCount: settingsItems.length,
        isCapped: false,
        isGlobal: false,
      },
    ];

    return allCategories.filter((category) => category.items.length > 0);
  }, [
    teamUrl,
    hasValidSearch,
    searchDocumentsData,
    searchTemplatesData,
    adminSearchCategories,
    filterBySearch,
    goToPage,
  ]);

  const effectiveChip = categories.some((category) => category.id === activeChip && category.chipCount !== null)
    ? activeChip
    : 'all';

  const visibleCategories =
    effectiveChip === 'all' ? categories : categories.filter((category) => category.id === effectiveChip);

  const totalVisibleCount = visibleCategories.reduce((total, category) => total + category.count, 0);
  const isVisibleCountCapped = visibleCategories.some((category) => category.isCapped);

  const totalAllCount = categories.reduce((total, category) => total + category.count, 0);
  const isAllCountCapped = categories.some((category) => category.isCapped);

  const isAnySearchFetching = isFetchingDocuments || isFetchingTemplates || isFetchingAdminSearch;

  const hasSearchError = isDocumentsSearchError || isTemplatesSearchError || isAdminSearchError;

  const formatChipCount = (count: number, isCapped: boolean) => (isCapped ? `≥${count}` : `${count}`);

  const goToSettings = useCallback(() => push('/settings'), [push]);
  const goToDocuments = useCallback(() => {
    if (teamUrl) {
      push(`/t/${teamUrl}/documents?status=ALL`);
    }
  }, [push, teamUrl]);
  const goToTemplates = useCallback(() => {
    if (teamUrl) {
      push(`/t/${teamUrl}/templates`);
    }
  }, [push, teamUrl]);

  useHotkeys(['ctrl+k', 'meta+k'], toggleOpen, { preventDefault: true });
  useHotkeys(SETTINGS_PAGE_SHORTCUT, goToSettings);
  useHotkeys(DOCUMENTS_PAGE_SHORTCUT, goToDocuments);
  useHotkeys(TEMPLATES_PAGE_SHORTCUT, goToTemplates);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Escape goes to the previous page, or closes the prompt at the root.
    // Backspace goes to the previous page when the search is empty.
    if (event.key === 'Escape' || (event.key === 'Backspace' && !search)) {
      event.preventDefault();

      if (activePage === null) {
        setOpen(false);
      }

      setActivePage(null);
    }
  };

  const isSearchLoading = isAnySearchFetching && hasValidSearch;

  const showSearchError = hasValidSearch && !isAnySearchFetching && hasSearchError;

  const showNoResults = hasValidSearch && totalVisibleCount === 0 && !isAnySearchFetching && !hasSearchError;

  const placeholder = match(activePage)
    .with('theme', () => msg`Search themes…`)
    .with('language', () => msg`Search languages…`)
    .otherwise(() => (isUserAdmin ? msg`Search documents, users, organisations…` : msg`Type a command or search...`));

  return (
    <Dialog open={isPromptOpen} onOpenChange={setOpen}>
      <DialogContent
        hideClose={true}
        overlayClassName="bg-foreground/40 backdrop-blur-[3px]"
        className="mt-[11vh] flex max-h-[min(560px,76vh)] w-[620px] max-w-[calc(100vw-2rem)] flex-col gap-0 self-start overflow-hidden rounded-[10px] p-0 shadow-2xl sm:max-w-[620px]"
      >
        <Command
          shouldFilter={false}
          loop={true}
          value={commandValue}
          onValueChange={setCommandValue}
          onKeyDown={handleKeyDown}
        >
          <div className="relative flex-none">
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={_(placeholder)}
              className="h-14 pr-14 text-[15px]"
            />

            <button
              type="button"
              onClick={() => {
                // Mirror the escape key behaviour: back on sub pages,
                // otherwise close.
                if (activePage !== null) {
                  setActivePage(null);
                  return;
                }

                setOpen(false);
              }}
              className="absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              <Trans>esc</Trans>
            </button>
          </div>

          {activePage === null && (
            <div className="flex flex-none gap-1.5 overflow-x-auto border-b px-3.5 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <PromptChip
                label={_(msg`All`)}
                count={formatChipCount(totalAllCount, isAllCountCapped)}
                isActive={effectiveChip === 'all'}
                onSelect={() => setActiveChip('all')}
              />

              {categories
                .filter((category) => category.chipCount !== null)
                .map((category) => (
                  <PromptChip
                    key={category.id}
                    label={_(category.label)}
                    count={formatChipCount(category.chipCount ?? 0, category.isCapped)}
                    isActive={effectiveChip === category.id}
                    isGlobal={category.isGlobal}
                    onSelect={() => setActiveChip(category.id)}
                  />
                ))}
            </div>
          )}

          <CommandList className="max-h-none flex-1 overscroll-contain px-2 pt-0.5 pb-2">
            {activePage === null && (
              <>
                {isSearchLoading && (
                  // The single loading state, replacing the results while any
                  // search is in flight. Mirrors the padding and content
                  // height of the no results state below so swapping between
                  // them doesn't change the height of the prompt.
                  <div className="flex items-center justify-center px-5 pt-12 pb-11">
                    <div className="flex h-11 items-center">
                      <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                {!isSearchLoading &&
                  visibleCategories.map((category) => (
                    <CommandGroup
                      key={category.id}
                      heading={
                        category.isGlobal ? (
                          <span className="inline-flex items-center gap-1.5">
                            <GlobeIcon aria-hidden="true" className="h-3 w-3" />
                            <span className="sr-only">{_(msg`Global`)} </span>
                            {_(category.label)}
                          </span>
                        ) : (
                          _(category.label)
                        )
                      }
                      className={PROMPT_GROUP_CLASSNAME}
                    >
                      {category.items.map((item) => (
                        <PromptCommandItem key={item.id} item={item} query={trimmedSearch} push={push} />
                      ))}
                    </CommandGroup>
                  ))}

                {showSearchError && totalVisibleCount > 0 && (
                  // Partial failure: the results from the searches that
                  // succeeded stay visible, flagged as incomplete.
                  <div className="px-5 pt-2 pb-3 text-center text-muted-foreground text-xs">
                    <Trans>Some searches failed — results may be incomplete.</Trans>
                  </div>
                )}

                {showSearchError && totalVisibleCount === 0 && (
                  // Total failure: an honest error state instead of a
                  // misleading "No results", height-matched to it so the
                  // prompt doesn't jump.
                  <div className="px-5 pt-12 pb-11 text-center">
                    <div className="font-medium text-sm">
                      <Trans>Something went wrong</Trans>
                    </div>
                    <div className="mt-1 text-muted-foreground text-sm">
                      <Trans>We couldn’t complete the search. Try again.</Trans>
                    </div>
                  </div>
                )}

                {showNoResults && (
                  <div className="px-5 pt-12 pb-11 text-center">
                    <div className="font-medium text-sm">
                      <Trans>No results for “{trimmedSearch}”</Trans>
                    </div>
                    <div className="mt-1 text-muted-foreground text-sm">
                      <Trans>Try a different search or switch category.</Trans>
                    </div>
                  </div>
                )}
              </>
            )}

            {activePage === 'theme' && (
              <PromptThemeCommands query={trimmedSearch} push={push} onBack={() => setActivePage(null)} />
            )}
            {activePage === 'language' && (
              <PromptLanguageCommands query={trimmedSearch} push={push} onBack={() => setActivePage(null)} />
            )}
          </CommandList>

          <div className="flex h-10 flex-none items-center justify-between gap-3 border-t bg-muted/50 px-3.5">
            <div className="hidden items-center gap-3.5 text-muted-foreground text-xs sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <PromptKbd>↑</PromptKbd>
                <PromptKbd>↓</PromptKbd>
                <Trans>Navigate</Trans>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PromptKbd>↵</PromptKbd>
                <Trans>Open</Trans>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PromptKbd>esc</PromptKbd>
                {activePage === null ? <Trans>Close</Trans> : <Trans>Back</Trans>}
              </span>
            </div>

            <span className="ml-auto text-muted-foreground text-xs">
              {hasValidSearch ? (
                <Trans>{formatChipCount(totalVisibleCount, isVisibleCountCapped)} results</Trans>
              ) : (
                <Trans>{totalVisibleCount} items</Trans>
              )}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const PromptChip = ({
  label,
  count,
  isActive,
  isGlobal = false,
  onSelect,
}: {
  label: string;
  count: string;
  isActive: boolean;
  isGlobal?: boolean;
  onSelect: () => void;
}) => {
  const { _ } = useLingui();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={cn(
        'inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 font-medium text-[13px] transition-colors',
        isActive
          ? 'border-input bg-muted text-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
      )}
    >
      {isGlobal && (
        <>
          <GlobeIcon aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="sr-only">{_(msg`Global`)} </span>
        </>
      )}
      {label}
      <span className="font-normal opacity-60">{count}</span>
    </button>
  );
};

const PromptKbd = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-background px-1 font-mono text-[11px]">
      {children}
    </span>
  );
};

const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  if (!query) {
    return <>{text}</>;
  }

  const index = text.toLowerCase().indexOf(query.toLowerCase());

  if (index === -1) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-primary/40 text-inherit">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
};

const PromptCommandItem = ({
  item,
  query,
  push,
  disabled = false,
}: {
  item: PromptItem;
  query: string;
  push: (_path: string) => void;
  disabled?: boolean;
}) => {
  const { _ } = useLingui();

  const label = typeof item.label === 'string' ? item.label : _(item.label);

  const onSelect = () => {
    if (item.onAction) {
      item.onAction();
      return;
    }

    if (item.path) {
      push(item.path);
    }
  };

  const content = (
    <>
      <span
        className={cn(
          'inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground',
          item.initials && 'border-transparent bg-primary/10 font-semibold text-primary text-xs',
        )}
      >
        {item.initials ? item.initials : item.icon && <item.icon className="h-4 w-4" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground text-sm">
          <HighlightedText text={label} query={query} />
        </span>
        {item.sublabel && (
          <span className="mt-px block truncate text-muted-foreground text-xs">
            <HighlightedText text={item.sublabel} query={query} />
          </span>
        )}
      </span>

      {item.shortcut && <span className="text-muted-foreground text-xs tracking-widest">{item.shortcut}</span>}

      {item.isChecked && <CheckIcon className="h-4 w-4 flex-none text-primary" />}

      <span className="hidden h-[22px] w-[22px] flex-none items-center justify-center rounded border border-border bg-background text-muted-foreground group-aria-selected:inline-flex">
        <CornerDownLeftIcon className="h-3 w-3" />
      </span>
    </>
  );

  return (
    <CommandItem
      value={item.id}
      onSelect={onSelect}
      disabled={disabled}
      className="group items-center gap-3 rounded-lg px-2.5 py-2"
    >
      {item.path ? (
        <Link
          to={item.path}
          tabIndex={-1}
          className="flex w-full min-w-0 items-center gap-3"
          onClick={(event) => {
            // Let the browser handle modified clicks natively, such as opening
            // the link in a new tab, without navigating or closing the prompt.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
              event.stopPropagation();
              return;
            }

            // Plain clicks bubble to the CommandItem which navigates and
            // closes the prompt via onSelect.
            event.preventDefault();
          }}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </CommandItem>
  );
};

const PromptBackCommand = ({ onBack }: { onBack: () => void }) => {
  return (
    <PromptCommandItem
      query=""
      push={() => undefined}
      item={{
        id: 'back',
        label: msg`Back`,
        icon: ArrowLeftIcon,
        onAction: onBack,
      }}
    />
  );
};

const PromptThemeCommands = ({
  query,
  push,
  onBack,
}: {
  query: string;
  push: (_path: string) => void;
  onBack: () => void;
}) => {
  const { _ } = useLingui();

  const [theme, setTheme, metadata] = useTheme();

  const themes = [
    { id: 'theme-light', label: msg`Light Mode`, icon: SunIcon, theme: Theme.LIGHT },
    { id: 'theme-dark', label: msg`Dark Mode`, icon: MoonIcon, theme: Theme.DARK },
    { id: 'theme-system', label: msg`System Theme`, icon: MonitorIcon, theme: null },
  ] as const;

  const visibleThemes = themes.filter((item) => !query || commandScore(_(item.label), query) >= MIN_FUZZY_SCORE);

  const isThemeChecked = (itemTheme: Theme | null) => {
    if (itemTheme === null) {
      return metadata.definedBy === 'SYSTEM';
    }

    return metadata.definedBy === 'USER' && theme === itemTheme;
  };

  return (
    <>
      <PromptBackCommand onBack={onBack} />

      <CommandGroup heading={_(msg`Theme`)} className={PROMPT_GROUP_CLASSNAME}>
        {visibleThemes.map((item) => (
          <PromptCommandItem
            key={item.id}
            query={query}
            push={push}
            item={{
              id: item.id,
              label: item.label,
              icon: item.icon,
              onAction: () => setTheme(item.theme),
              isChecked: isThemeChecked(item.theme),
            }}
          />
        ))}
      </CommandGroup>
    </>
  );
};

const PromptLanguageCommands = ({
  query,
  push,
  onBack,
}: {
  query: string;
  push: (_path: string) => void;
  onBack: () => void;
}) => {
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

  const visibleLanguages = Object.values(SUPPORTED_LANGUAGES).filter(
    (language) => !query || commandScore(_(language.full), query) >= MIN_FUZZY_SCORE,
  );

  return (
    <>
      <PromptBackCommand onBack={onBack} />

      <CommandGroup heading={_(msg`Language`)} className={PROMPT_GROUP_CLASSNAME}>
        {visibleLanguages.map((language) => (
          <PromptCommandItem
            key={language.short}
            query={query}
            push={push}
            disabled={isLoading}
            item={{
              id: `language-${language.short}`,
              label: language.full,
              initials: language.short.toUpperCase(),
              onAction: async () => setLanguage(language.short),
              isChecked: i18n.locale === language.short,
            }}
          />
        ))}
      </CommandGroup>
    </>
  );
};
