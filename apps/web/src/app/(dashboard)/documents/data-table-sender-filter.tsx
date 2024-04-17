'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { trpc } from '@documenso/trpc/react';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';

type DataTableSenderFilterProps = {
  teamId: number;
};

export const DataTableSenderFilter = ({ teamId }: DataTableSenderFilterProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isMounted = useIsMounted();

  const senderIds = parseToIntegerArray(searchParams?.get('senderIds') ?? '');

  const { data, isInitialLoading } = trpc.team.getTeamMembers.useQuery({
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

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <MultiSelectCombobox
      emptySelectionPlaceholder={
        <p className="text-muted-foreground font-normal">
          <span className="text-muted-foreground/70">Sender:</span> All
        </p>
      }
      enableClearAllButton={true}
      inputPlaceholder="Search"
      loading={!isMounted || isInitialLoading}
      options={comboBoxOptions}
      selectedValues={senderIds}
      onChange={onChange}
    />
  );
};
