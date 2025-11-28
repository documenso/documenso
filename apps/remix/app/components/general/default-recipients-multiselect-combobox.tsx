import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { RecipientRole } from '@prisma/client';

import type { TDefaultRecipient } from '@documenso/lib/types/default-recipients';
import { trpc } from '@documenso/trpc/react';
import { MultiSelect, type Option } from '@documenso/ui/primitives/multiselect';

type DefaultRecipientsMultiSelectComboboxProps = {
  listValues: TDefaultRecipient[];
  onChange: (_values: TDefaultRecipient[]) => void;
  teamId?: number;
  organisationId?: string;
};

export const DefaultRecipientsMultiSelectCombobox = ({
  listValues,
  onChange,
  teamId,
  organisationId,
}: DefaultRecipientsMultiSelectComboboxProps) => {
  const { _ } = useLingui();

  const { data: organisationData, isLoading: isLoadingOrganisation } =
    trpc.organisation.member.find.useQuery(
      {
        organisationId: organisationId!,
        query: '',
        page: 1,
        perPage: 100,
      },
      {
        enabled: !!organisationId,
      },
    );

  const { data: teamData, isLoading: isLoadingTeam } = trpc.team.member.find.useQuery(
    {
      teamId: teamId!,
      query: '',
      page: 1,
      perPage: 100,
    },
    {
      enabled: !!teamId,
    },
  );

  const members = organisationId ? organisationData?.data : teamData?.data;
  const isLoading = organisationId ? isLoadingOrganisation : isLoadingTeam;

  const options = members?.map((member) => ({
    value: member.email,
    label: member.name ? `${member.name} (${member.email})` : member.email,
  }));

  const value = listValues.map((recipient) => ({
    value: recipient.email,
    label: recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email,
  }));

  const onSelectionChange = (selected: Option[]) => {
    const updatedRecipients = selected.map((option) => {
      const existingRecipient = listValues.find((r) => r.email === option.value);
      const member = members?.find((m) => m.email === option.value);

      return {
        email: option.value,
        name: member?.name || option.value,
        role: existingRecipient?.role ?? RecipientRole.CC,
      };
    });

    onChange(updatedRecipients);
  };

  return (
    <MultiSelect
      commandProps={{ label: _(msg`Select recipients`) }}
      options={options}
      value={value}
      onChange={onSelectionChange}
      placeholder={_(msg`Select recipients`)}
      hideClearAllButton
      hidePlaceholderWhenSelected
      loadingIndicator={isLoading ? <p className="text-center text-sm">Loading...</p> : undefined}
      emptyIndicator={<p className="text-center text-sm">No members found</p>}
    />
  );
};
