import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Trans } from '@lingui/react/macro';
import { ArrowUpDownIcon, ChevronDownIcon } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

/**
 * Quiet "Sort" text dropdown, used in the folder section headers so it
 * takes almost no space next to the document controls.
 */
export const FolderSortDropdown = () => {
  const { folderSort, hasSelectedFolderSort, setFolderSort } = useFolderSort();

  const selectedOption = FOLDER_SORT_OPTIONS.find((option) => option.value === folderSort);

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
            <>
              <Trans>Sort by</Trans>
              <span className="font-medium text-foreground">{selectedOption?.label}</span>
            </>
          ) : (
            <Trans>Sort</Trans>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={folderSort}
          onValueChange={(value) => setFolderSort(parseFolderSortValue(value))}
        >
          {FOLDER_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const useFolderSort = () => {
  // Uses nuqs like the document filters so sort updates don't overwrite their
  // params. Null until the user picks a sort, so the trigger can tell an
  // explicit "Newest first" apart from the untouched default.
  const [selectedFolderSort, setFolderSortQuery] = useQueryState(FOLDER_SORT_SEARCH_PARAM, folderSortSearchParam);

  const folderSort = selectedFolderSort ?? DEFAULT_FOLDER_SORT;
  const hasSelectedFolderSort = selectedFolderSort !== null;

  const setFolderSort = (value: TFolderSortValue) => {
    void setFolderSortQuery(value);
  };

  /**
   * Carries the current sort onto a folder link so it survives navigating
   * into subfolders and back up the breadcrumbs.
   */
  const withFolderSort = (path: string) => {
    if (!hasSelectedFolderSort) {
      return path;
    }

    const separator = path.includes('?') ? '&' : '?';

    return `${path}${separator}${FOLDER_SORT_SEARCH_PARAM}=${folderSort}`;
  };

  const sortFolders = <T extends TSortableFolder>(folders: T[]) => {
    return [...folders].sort(FOLDER_SORT_COMPARATORS[folderSort]);
  };

  return { folderSort, hasSelectedFolderSort, setFolderSort, sortFolders, withFolderSort };
};

const parseFolderSortValue = (value: string | null): TFolderSortValue => {
  return FOLDER_SORT_VALUES.find((sortValue) => sortValue === value) ?? DEFAULT_FOLDER_SORT;
};

const compareByName = (a: TSortableFolder, b: TSortableFolder) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const compareByCreatedAt = (a: TSortableFolder, b: TSortableFolder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

const FOLDER_SORT_SEARCH_PARAM = 'folderSort';

const FOLDER_SORT_VALUES = ['createdAt-desc', 'createdAt-asc', 'name-asc', 'name-desc'] as const;

const FOLDER_SORT_OPTIONS = [
  { value: 'createdAt-desc', label: <Trans>Newest first</Trans> },
  { value: 'createdAt-asc', label: <Trans>Oldest first</Trans> },
  { value: 'name-asc', label: <Trans>Name (A-Z)</Trans> },
  { value: 'name-desc', label: <Trans>Name (Z-A)</Trans> },
];

const FOLDER_SORT_COMPARATORS: Record<TFolderSortValue, (a: TSortableFolder, b: TSortableFolder) => number> = {
  'createdAt-desc': (a, b) => compareByCreatedAt(b, a),
  'createdAt-asc': compareByCreatedAt,
  'name-asc': compareByName,
  'name-desc': (a, b) => compareByName(b, a),
};

const DEFAULT_FOLDER_SORT: TFolderSortValue = 'createdAt-desc';

const folderSortSearchParam = parseAsStringLiteral(FOLDER_SORT_VALUES).withOptions({ history: 'push' });

type TFolderSortValue = (typeof FOLDER_SORT_VALUES)[number];

type TSortableFolder = {
  name: string;
  createdAt: Date | string;
};
