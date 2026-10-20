import { Trans } from '@lingui/react/macro';
import { ArrowUpDownIcon } from 'lucide-react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { FilterPill } from '~/components/general/filter-pill';

export const FOLDER_SORT_SEARCH_PARAM = 'folderSort';

const FOLDER_SORT_PILL_OPTIONS = [
  { value: 'createdAt-desc', label: <Trans>Newest first</Trans> },
  { value: 'createdAt-asc', label: <Trans>Oldest first</Trans> },
  { value: 'name-asc', label: <Trans>Name A-Z</Trans> },
  { value: 'name-desc', label: <Trans>Name Z-A</Trans> },
];

export const FolderSortFilter = () => {
  const { folderSort, isDefaultFolderSort, setFolderSort } = useFolderSort();

  return (
    <FilterPill
      icon={ArrowUpDownIcon}
      label={<Trans>Sort</Trans>}
      value={isDefaultFolderSort ? null : folderSort}
      onChange={(value) => setFolderSort(parseFolderSortValue(value))}
      options={FOLDER_SORT_PILL_OPTIONS}
      testId="folder-sort-filter"
    />
  );
};

export const useFolderSort = () => {
  // Goes through nuqs, like the document filters, so updates are applied on
  // top of the latest URL instead of overwriting params nuqs has just set.
  const [folderSort, setFolderSortQuery] = useQueryState(FOLDER_SORT_SEARCH_PARAM, folderSortSearchParam);

  const isDefaultFolderSort = folderSort === DEFAULT_FOLDER_SORT;

  const setFolderSort = (value: TFolderSortValue) => {
    void setFolderSortQuery(value);
  };

  /**
   * Carries the current sort onto a folder link so it survives navigating
   * into subfolders and back up the breadcrumbs.
   */
  const withFolderSort = (path: string) => {
    if (isDefaultFolderSort) {
      return path;
    }

    const separator = path.includes('?') ? '&' : '?';

    return `${path}${separator}${FOLDER_SORT_SEARCH_PARAM}=${folderSort}`;
  };

  const sortFolders = <T extends TSortableFolder>(folders: T[]) => {
    return [...folders].sort(FOLDER_SORT_COMPARATORS[folderSort]);
  };

  return { folderSort, isDefaultFolderSort, setFolderSort, sortFolders, withFolderSort };
};

const parseFolderSortValue = (value: string | null): TFolderSortValue => {
  return FOLDER_SORT_VALUES.find((sortValue) => sortValue === value) ?? DEFAULT_FOLDER_SORT;
};

const compareByName = (a: TSortableFolder, b: TSortableFolder) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const compareByCreatedAt = (a: TSortableFolder, b: TSortableFolder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

const FOLDER_SORT_VALUES = ['createdAt-desc', 'createdAt-asc', 'name-asc', 'name-desc'] as const;

const FOLDER_SORT_COMPARATORS: Record<TFolderSortValue, (a: TSortableFolder, b: TSortableFolder) => number> = {
  'createdAt-desc': (a, b) => compareByCreatedAt(b, a),
  'createdAt-asc': compareByCreatedAt,
  'name-asc': compareByName,
  'name-desc': (a, b) => compareByName(b, a),
};

const DEFAULT_FOLDER_SORT: TFolderSortValue = 'createdAt-desc';

const folderSortSearchParam = parseAsStringLiteral(FOLDER_SORT_VALUES)
  .withDefault(DEFAULT_FOLDER_SORT)
  .withOptions({ history: 'push', clearOnDefault: true });

type TFolderSortValue = (typeof FOLDER_SORT_VALUES)[number];

type TSortableFolder = {
  name: string;
  createdAt: Date | string;
};
