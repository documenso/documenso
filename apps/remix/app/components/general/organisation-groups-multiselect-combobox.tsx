import { trpc } from '@documenso/trpc/react';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationGroupType } from '@prisma/client';

export type OrganisationGroupOption = {
  /** Organisation group ID. */
  id: string;
  name: string;
};

type OrganisationGroupsMultiSelectComboboxProps = {
  organisationId: string;
  /**
   * Currently selected groups. Must include name so chips render with
   * proper labels even before the first server search returns results.
   */
  selectedGroups: OrganisationGroupOption[];
  onChange: (groups: OrganisationGroupOption[]) => void;
  /**
   * If set, organisation groups already attached to this team are filtered
   * out of the search results server-side. Used by "add groups to team" flows.
   */
  excludeTeamId?: number;
  /**
   * Restrict search to specific group types. Defaults to CUSTOM groups only,
   * matching how groups are managed in the organisation settings UI.
   */
  types?: OrganisationGroupType[];
  /** Number of groups to fetch per search call. Defaults to the schema cap (100). */
  perPage?: number;
  className?: string;
  dataTestId?: string;
};

const toOption = (group: OrganisationGroupOption): Option => ({
  value: group.id,
  label: group.name,
  groupName: group.name,
});

const fromOption = (option: Option): OrganisationGroupOption => ({
  id: option.value,
  name: typeof option.groupName === 'string' ? option.groupName : option.label,
});

/**
 * Searchable multi-select combobox for picking organisation groups,
 * backed by `trpc.organisation.group.find` with server-side search.
 *
 * Renders selected groups as chips and supports an unbounded number of
 * organisation groups (paged out via debounced server queries).
 */
export const OrganisationGroupsMultiSelectCombobox = ({
  organisationId,
  selectedGroups,
  onChange,
  excludeTeamId,
  types = [OrganisationGroupType.CUSTOM],
  perPage = 100,
  className,
  dataTestId,
}: OrganisationGroupsMultiSelectComboboxProps) => {
  const { _ } = useLingui();

  const utils = trpc.useUtils();

  const handleSearch = async (query: string): Promise<Option[]> => {
    const result = await utils.organisation.group.find.fetch({
      organisationId,
      query,
      page: 1,
      perPage,
      types,
      excludeTeamId,
    });

    return result.data.map((group) =>
      toOption({
        id: group.id,
        name: group.name ?? '',
      }),
    );
  };

  return (
    <MultiSelect
      className={className}
      data-testid={dataTestId}
      commandProps={{ label: _(msg`Select groups`) }}
      inputProps={{ 'aria-label': _(msg`Select groups`) }}
      placeholder={_(msg`Search groups by name`)}
      value={selectedGroups.map(toOption)}
      onChange={(options) => onChange(options.map(fromOption))}
      onSearch={handleSearch}
      triggerSearchOnFocus
      hideClearAllButton
      hidePlaceholderWhenSelected
      delay={300}
      loadingIndicator={
        <p className="py-4 text-center text-muted-foreground text-sm">
          <Trans>Loading...</Trans>
        </p>
      }
      emptyIndicator={
        <p className="py-4 text-center text-muted-foreground text-sm">
          <Trans>No groups found</Trans>
        </p>
      }
    />
  );
};
