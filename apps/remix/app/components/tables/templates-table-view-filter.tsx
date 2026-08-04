import { Trans } from '@lingui/react/macro';
import { Building2Icon } from 'lucide-react';
import { useQueryStates } from 'nuqs';

import { FilterPill } from '~/components/general/filter-pill';
import { TEMPLATES_VIEW_VALUES, templatesSearchParams } from '~/utils/templates-search-params';

const VIEW_OPTIONS = [
  { value: 'team', label: <Trans>Team</Trans> },
  { value: 'organisation', label: <Trans>Organisation</Trans> },
];

export const TemplatesTableViewFilter = () => {
  const [{ view }, setSearchParams] = useQueryStates(
    {
      view: templatesSearchParams.view,
      page: templatesSearchParams.page,
    },
    { history: 'push' },
  );

  const onChange = (newView: string | null) => {
    void setSearchParams({
      view: TEMPLATES_VIEW_VALUES.find((value) => value === newView) ?? null,
      page: null,
    });
  };

  return (
    <FilterPill
      icon={Building2Icon}
      label={<Trans>View</Trans>}
      value={view}
      onChange={onChange}
      options={VIEW_OPTIONS}
      testId="templates-table-view-filter"
    />
  );
};
