import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { UserIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';

import { FilterPill } from '~/components/general/filter-pill';
import { documentsSearchParams } from '~/utils/documents-search-params';

type DocumentsTableSenderFilterProps = {
  teamId: number;
};

export const DocumentsTableSenderFilter = ({ teamId }: DocumentsTableSenderFilterProps) => {
  const { _ } = useLingui();

  const isMounted = useIsMounted();

  const [{ senderIds }, setSearchParams] = useQueryStates(
    {
      senderIds: documentsSearchParams.senderIds,
      page: documentsSearchParams.page,
    },
    { history: 'push' },
  );

  const selectedSenderIds = (senderIds ?? []).map((senderId) => senderId.toString());

  const { data, isLoading } = trpc.team.member.getMany.useQuery({
    teamId,
  });

  const options = (data ?? []).map((member) => ({
    label: member.name ?? member.email,
    value: member.userId.toString(),
  }));

  const onChange = (newSenderIds: string[]) => {
    void setSearchParams({
      senderIds: newSenderIds.length > 0 ? newSenderIds.map(Number) : null,
      page: null,
    });
  };

  return (
    <FilterPill
      multiple
      icon={UserIcon}
      label={<Trans>Sender</Trans>}
      value={selectedSenderIds}
      onChange={onChange}
      options={options}
      enableSearch
      searchPlaceholder={_(msg`Search members...`)}
      loading={!isMounted || isLoading}
      testId="documents-table-sender-filter"
    />
  );
};
