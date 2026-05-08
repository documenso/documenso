import { trpc } from '@documenso/trpc/react';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

export type OrganisationMemberOption = {
  /** Organisation member ID. */
  id: string;
  name: string;
  email: string;
};

type OrganisationMembersMultiSelectComboboxProps = {
  organisationId: string;
  /**
   * Currently selected members. Must include name/email so chips render with
   * proper labels even before the first server search returns results.
   */
  selectedMembers: OrganisationMemberOption[];
  onChange: (members: OrganisationMemberOption[]) => void;
  /**
   * If set, organisation members already on this team are filtered out of the
   * search results server-side. Used by "add members to team" flows.
   */
  excludeTeamId?: number;
  /** Number of members to fetch per search call. Defaults to the schema cap (100). */
  perPage?: number;
  className?: string;
  dataTestId?: string;
};

const toOption = (member: OrganisationMemberOption): Option => ({
  value: member.id,
  label: member.name ? `${member.name} (${member.email})` : member.email,
  // Stash these so we can reconstruct OrganisationMemberOption on change.
  email: member.email,
  name: member.name,
});

const fromOption = (option: Option): OrganisationMemberOption => ({
  id: option.value,
  name: typeof option.name === 'string' ? option.name : '',
  email: typeof option.email === 'string' ? option.email : '',
});

/**
 * Searchable multi-select combobox for picking organisation members,
 * backed by `trpc.organisation.member.find` with server-side search.
 *
 * Renders selected members as chips and supports an unbounded number of
 * organisation members (paged out via debounced server queries).
 */
export const OrganisationMembersMultiSelectCombobox = ({
  organisationId,
  selectedMembers,
  onChange,
  excludeTeamId,
  perPage = 100,
  className,
  dataTestId,
}: OrganisationMembersMultiSelectComboboxProps) => {
  const { _ } = useLingui();

  const utils = trpc.useUtils();

  const handleSearch = async (query: string): Promise<Option[]> => {
    const result = await utils.organisation.member.find.fetch({
      organisationId,
      query,
      page: 1,
      perPage,
      excludeTeamId,
    });

    return result.data.map((member) =>
      toOption({
        id: member.id,
        name: member.name,
        email: member.email,
      }),
    );
  };

  return (
    <MultiSelect
      className={className}
      data-testid={dataTestId}
      commandProps={{ label: _(msg`Select members`) }}
      inputProps={{ 'aria-label': _(msg`Select members`) }}
      placeholder={_(msg`Search members by name or email`)}
      value={selectedMembers.map(toOption)}
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
          <Trans>No members found</Trans>
        </p>
      }
    />
  );
};
