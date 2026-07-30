import { useSession } from '@documenso/lib/client-only/providers/session';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION, SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { trpc as trpcReact } from '@documenso/trpc/react';
import type { TAdminSearchResultType } from '@documenso/trpc/server/admin-router/admin-search.types';
import { ADMIN_SEARCH_MAX_QUERY_LENGTH } from '@documenso/trpc/server/admin-router/admin-search.types';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { keepPreviousData } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { ArrowRightIcon, Building2Icon, CreditCardIcon, FileTextIcon, UserIcon, UsersIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { PromptCategory, PromptItem } from './app-command-menu.types';

/**
 * The maximum number of results the admin search returns per resource type.
 */
const ADMIN_SEARCH_RESULTS_CAP = 5;

const ADMIN_GROUP_LABELS: Record<TAdminSearchResultType, MessageDescriptor> = {
  document: msg`Documents`,
  user: msg`Users`,
  organisation: msg`Organisations`,
  team: msg`Teams`,
  recipient: msg`Recipients`,
  subscription: msg`Subscriptions`,
};

const ADMIN_GROUP_ICONS: Record<TAdminSearchResultType, LucideIcon> = {
  document: FileTextIcon,
  user: UserIcon,
  organisation: Building2Icon,
  team: UsersIcon,
  recipient: UserIcon,
  subscription: CreditCardIcon,
};

/**
 * Admin list pages which support prefilling their search from the URL, used
 * for the "View all results" links on capped groups. Teams, recipients and
 * subscriptions have no admin list pages.
 */
const ADMIN_GROUP_LIST_PATHS: Partial<Record<TAdminSearchResultType, (_query: string) => string>> = {
  document: (query) => `/admin/documents?term=${encodeURIComponent(query)}`,
  user: (query) => `/admin/users?search=${encodeURIComponent(query)}`,
  organisation: (query) => `/admin/organisations?query=${encodeURIComponent(query)}`,
};

export type UseAdminSearchCategoriesOptions = {
  /**
   * The trimmed, debounced search query.
   */
  query: string;
  open: boolean;
};

/**
 * The isolated admin portion of the command prompt: searches every admin
 * resource and maps the results to prompt categories marked as global.
 *
 * Returns no categories and never queries for non admin users. The admin
 * search endpoint is additionally guarded server side by the admin procedure.
 */
export const useAdminSearchCategories = ({ query, open }: UseAdminSearchCategoriesOptions) => {
  const { user } = useSession();

  const isUserAdmin = isAdmin(user);

  // Admin searches hit every resource table, so require a longer query unless
  // it is a number, which could be a resource ID of any length. Queries over
  // the endpoint's length limit are skipped entirely instead of being sent
  // and rejected.
  const hasValidAdminSearch =
    isUserAdmin && query.length <= ADMIN_SEARCH_MAX_QUERY_LENGTH && (query.length > 3 || /^\d+$/.test(query));

  const {
    data: adminSearchData,
    isFetching,
    isError,
  } = trpcReact.admin.search.useQuery(
    {
      query,
    },
    {
      enabled: open && hasValidAdminSearch,
      placeholderData: keepPreviousData,
      // Retyping is the retry in a search-as-you-type flow: fail fast so the
      // prompt can surface an honest error state instead of retrying.
      retry: false,
      ...SKIP_QUERY_BATCH_META,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    },
  );

  const categories = useMemo((): PromptCategory[] => {
    if (!hasValidAdminSearch || !adminSearchData) {
      return [];
    }

    return adminSearchData.groups.map((group) => {
      const isCapped = group.results.length >= ADMIN_SEARCH_RESULTS_CAP;
      const buildListPath = ADMIN_GROUP_LIST_PATHS[group.type];

      const items: PromptItem[] = group.results.map((result) => ({
        id: `admin-${group.type}-${result.value}`,
        label: result.label,
        sublabel: result.sublabel,
        path: result.path,
        icon: ADMIN_GROUP_ICONS[group.type],
        initials: group.type === 'user' || group.type === 'recipient' ? extractInitials(result.label) : undefined,
      }));

      // Capped groups link to the full admin list page with the search
      // prefilled so the cap is never a dead end.
      if (isCapped && buildListPath) {
        items.push({
          id: `admin-${group.type}-view-all`,
          label: msg`View all results`,
          path: buildListPath(query),
          icon: ArrowRightIcon,
        });
      }

      return {
        id: `admin-${group.type}`,
        label: ADMIN_GROUP_LABELS[group.type],
        items,
        count: group.results.length,
        chipCount: group.results.length,
        isCapped,
        isGlobal: true,
      };
    });
  }, [hasValidAdminSearch, adminSearchData, query]);

  return {
    isUserAdmin,
    categories,
    isFetching,
    isError,
  };
};
