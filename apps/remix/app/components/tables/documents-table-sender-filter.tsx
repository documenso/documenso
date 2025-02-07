import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';

type DocumentsTableSenderFilterProps = {
  teamId: number;
};

export const DocumentsTableSenderFilter = ({ teamId }: DocumentsTableSenderFilterProps) => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isMounted = useIsMounted();

  const senderIds = parseToIntegerArray(searchParams?.get('senderIds') ?? '');

  const { data, isLoading } = trpc.team.getTeamMembers.useQuery({
    teamId,
  });

  const comboBoxOptions = (data ?? []).map((member) => ({
    label: member.user.name ?? member.user.email,
    value: member.user.id,
  }));

  const onChange = (newSenderIds: number[]) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('senderIds', newSenderIds.join(','));

    if (newSenderIds.length === 0) {
      params.delete('senderIds');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <MultiSelectCombobox
      emptySelectionPlaceholder={
        <p className="text-muted-foreground font-normal">
          <Trans>
            <span className="text-muted-foreground/70">Sender:</span> All
          </Trans>
        </p>
      }
      enableClearAllButton={true}
      inputPlaceholder={msg`Search`}
      loading={!isMounted || isLoading}
      options={comboBoxOptions}
      selectedValues={senderIds}
      onChange={onChange}
    />
  );
};
