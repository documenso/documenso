import { Trans } from '@lingui/react/macro';
import { ArrowUpDownIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';

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
  const [searchParams, setSearchParams] = useSearchParams();

  const folderSort = parseFolderSortValue(searchParams.get(FOLDER_SORT_SEARCH_PARAM));
  const isDefaultFolderSort = folderSort === DEFAULT_FOLDER_SORT;

  const setFolderSort = (value: TFolderSortValue) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);

        if (value === DEFAULT_FOLDER_SORT) {
          params.delete(FOLDER_SORT_SEARCH_PARAM);
        } else {
          params.set(FOLDER_SORT_SEARCH_PARAM, value);
        }

        return params;
      },
      { preventScrollReset: true },
    );
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
  if (value && Object.hasOwn(FOLDER_SORT_COMPARATORS, value)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value as TFolderSortValue;
  }

  return DEFAULT_FOLDER_SORT;
};

const compareByName = (a: TSortableFolder, b: TSortableFolder) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const compareByCreatedAt = (a: TSortableFolder, b: TSortableFolder) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

const FOLDER_SORT_COMPARATORS = {
  'createdAt-desc': (a: TSortableFolder, b: TSortableFolder) => compareByCreatedAt(b, a),
  'createdAt-asc': compareByCreatedAt,
  'name-asc': compareByName,
  'name-desc': (a: TSortableFolder, b: TSortableFolder) => compareByName(b, a),
};

const DEFAULT_FOLDER_SORT: TFolderSortValue = 'createdAt-desc';

type TFolderSortValue = keyof typeof FOLDER_SORT_COMPARATORS;

type TSortableFolder = {
  name: string;
  createdAt: Date | string;
};
