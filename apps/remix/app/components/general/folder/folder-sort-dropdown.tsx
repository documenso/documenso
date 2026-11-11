import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowUpDownIcon, ChevronDownIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { useUserPreferences } from '~/providers/user-preferences';
import { type TFolderSortValue, ZFolderSortSchema } from '~/utils/user-preferences';

export const FolderSortDropdown = () => {
  const { folderSort, hasSelectedFolderSort, setFolderSort } = useFolderSort();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md text-muted-foreground text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="folder-sort-dropdown"
        >
          <ArrowUpDownIcon className="h-4 w-4" />
          {hasSelectedFolderSort ? (
            match(folderSort)
              .with('created-desc', () => (
                <Trans>
                  Sort by <span className="font-medium text-foreground">Newest first</span>
                </Trans>
              ))
              .with('created-asc', () => (
                <Trans>
                  Sort by <span className="font-medium text-foreground">Oldest first</span>
                </Trans>
              ))
              .with('name-asc', () => (
                <Trans>
                  Sort by <span className="font-medium text-foreground">Name (A-Z)</span>
                </Trans>
              ))
              .with('name-desc', () => (
                <Trans>
                  Sort by <span className="font-medium text-foreground">Name (Z-A)</span>
                </Trans>
              ))
              .exhaustive()
          ) : (
            <Trans>Sort</Trans>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={folderSort}
          onValueChange={(value) => {
            const result = ZFolderSortSchema.safeParse(value);

            if (result.success) {
              setFolderSort(result.data);
            }
          }}
        >
          {ZFolderSortSchema.options.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {FOLDER_SORT_OPTIONS[value].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const useFolderSort = () => {
  const { i18n } = useLingui();
  const { preferences, updatePreferences } = useUserPreferences();

  const selectedFolderSort = preferences.folderSort;

  const folderSort = selectedFolderSort ?? DEFAULT_FOLDER_SORT;

  const setFolderSort = (value: TFolderSortValue) => {
    updatePreferences({ folderSort: value });
  };

  const sortFolders = <T extends TSortableFolder>(folders: T[]) => {
    const { compare } = FOLDER_SORT_OPTIONS[folderSort];

    return [...folders].sort((a, b) => compare(a, b, i18n.locale));
  };

  return {
    folderSort,
    hasSelectedFolderSort: selectedFolderSort !== undefined,
    setFolderSort,
    sortFolders,
  };
};

const compareByName = (a: TSortableFolder, b: TSortableFolder, locale: string) =>
  a.name.localeCompare(b.name, locale, { numeric: true, sensitivity: 'base' });

const compareByCreatedAt = (a: TSortableFolder, b: TSortableFolder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

const DEFAULT_FOLDER_SORT: TFolderSortValue = 'created-desc';

const FOLDER_SORT_OPTIONS: Record<TFolderSortValue, TFolderSortOption> = {
  'created-desc': {
    label: <Trans>Newest first</Trans>,
    compare: (a, b) => compareByCreatedAt(b, a),
  },
  'created-asc': {
    label: <Trans>Oldest first</Trans>,
    compare: compareByCreatedAt,
  },
  'name-asc': {
    label: <Trans>Name (A-Z)</Trans>,
    compare: compareByName,
  },
  'name-desc': {
    label: <Trans>Name (Z-A)</Trans>,
    compare: (a, b, locale) => compareByName(b, a, locale),
  },
};

type TSortableFolder = {
  name: string;
  createdAt: Date | string;
};

type TFolderSortOption = {
  label: React.ReactNode;
  compare: (a: TSortableFolder, b: TSortableFolder, locale: string) => number;
};
