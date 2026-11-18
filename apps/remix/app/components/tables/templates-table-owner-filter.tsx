import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { UserIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';

import { FilterPill } from '~/components/general/filter-pill';
import { templatesSearchParams } from '~/utils/templates-search-params';

type TemplatesTableOwnerFilterProps = {
  teamId: number;
};

export const TemplatesTableOwnerFilter = ({ teamId }: TemplatesTableOwnerFilterProps) => {
  const { _ } = useLingui();

  const isMounted = useIsMounted();

  const [{ ownerIds }, setSearchParams] = useQueryStates(
    {
      ownerIds: templatesSearchParams.ownerIds,
      page: templatesSearchParams.page,
    },
    { history: 'push' },
  );

  const selectedOwnerIds = (ownerIds ?? []).map((ownerId) => ownerId.toString());

  const { data, isLoading } = trpc.team.member.getMany.useQuery({
    teamId,
  });

  const options = (data ?? []).map((member) => ({
    label: member.name ?? member.email,
    value: member.userId.toString(),
  }));

  const onChange = (newOwnerIds: string[]) => {
    void setSearchParams({
      ownerIds: newOwnerIds.length > 0 ? newOwnerIds.map(Number) : null,
      page: null,
    });
  };

  return (
    <FilterPill
      multiple
      icon={UserIcon}
      label={<Trans>Owner</Trans>}
      value={selectedOwnerIds}
      onChange={onChange}
      options={options}
      enableSearch
      searchPlaceholder={_(msg`Search members...`)}
      loading={!isMounted || isLoading}
      testId="templates-table-owner-filter"
    />
  );
};
