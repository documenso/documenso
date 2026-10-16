import { trpc } from '@documenso/trpc/react';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';
import { Trans, useLingui } from '@lingui/react/macro';

export type AdminOrganisationOption = {
  id: string;
  name: string;
  url: string;
};

type AdminOrganisationsMultiSelectComboboxProps = {
  /**
   * Currently selected organisations. Must include name/url so chips render with proper labels
   * before the first search returns results.
   */
  selectedOrganisations: AdminOrganisationOption[];
  onChange: (organisations: AdminOrganisationOption[]) => void;
  className?: string;
  dataTestId?: string;
};

const toOption = (organisation: AdminOrganisationOption): Option => ({
  value: organisation.id,
  label: `${organisation.name} (${organisation.url})`,
  // Stash these so we can reconstruct AdminOrganisationOption on change.
  name: organisation.name,
  url: organisation.url,
});

const fromOption = (option: Option): AdminOrganisationOption => ({
  id: option.value,
  name: typeof option.name === 'string' ? option.name : '',
  url: typeof option.url === 'string' ? option.url : '',
});

/**
 * Searchable multi-select for picking organisations across the platform, backed by
 * `trpc.admin.organisation.find` with server-side search.
 */
export const AdminOrganisationsMultiSelectCombobox = ({
  selectedOrganisations,
  onChange,
  className,
  dataTestId,
}: AdminOrganisationsMultiSelectComboboxProps) => {
  const { t } = useLingui();

  const utils = trpc.useUtils();

  const handleSearch = async (query: string): Promise<Option[]> => {
    const result = await utils.admin.organisation.find.fetch({
      query,
      page: 1,
      perPage: 20,
    });

    return result.data.map((organisation) =>
      toOption({
        id: organisation.id,
        name: organisation.name,
        url: organisation.url,
      }),
    );
  };

  return (
    <MultiSelect
      className={className}
      data-testid={dataTestId}
      commandProps={{ label: t`Select organisations` }}
      inputProps={{ 'aria-label': t`Select organisations` }}
      placeholder={t`Search organisations by name, ID or owner email`}
      value={selectedOrganisations.map(toOption)}
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
          <Trans>No organisations found</Trans>
        </p>
      }
    />
  );
};
