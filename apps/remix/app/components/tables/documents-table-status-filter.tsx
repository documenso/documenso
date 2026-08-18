import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { STATS_COUNT_CAP } from '@documenso/lib/constants/document';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import type { TFindDocumentsInternalResponse } from '@documenso/trpc/server/document-router/find-documents-internal.types';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationType } from '@prisma/client';
import { ListFilterIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';

import { DocumentStatus, FRIENDLY_STATUS_MAP } from '~/components/general/document/document-status';
import { FilterPill } from '~/components/general/filter-pill';
import { documentsSearchParams } from '~/utils/documents-search-params';

type DocumentsTableStatusFilterProps = {
  stats: TFindDocumentsInternalResponse['stats'];
};

export const DocumentsTableStatusFilter = ({ stats }: DocumentsTableStatusFilterProps) => {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();

  const [{ status }, setSearchParams] = useQueryStates(
    {
      status: documentsSearchParams.status,
      page: documentsSearchParams.page,
    },
    { history: 'push', shallow: false },
  );

  const selectableStatuses = useMemo(
    () =>
      SELECTABLE_STATUSES.filter((value) => {
        if (organisation.type === OrganisationType.PERSONAL) {
          return value !== ExtendedDocumentStatus.INBOX;
        }

        return true;
      }),
    [organisation.type],
  );

  const selectedStatus = useMemo(
    () => selectableStatuses.find((value) => value === status) ?? null,
    [selectableStatuses, status],
  );

  const onChange = (newStatus: string | null) => {
    void setSearchParams({
      status: selectableStatuses.find((value) => value === newStatus) ?? null,
      page: null,
    });
  };

  return (
    <>
      <FilterPill
        icon={ListFilterIcon}
        label={<Trans>Status</Trans>}
        value={selectedStatus}
        onChange={onChange}
        selectedLabel={selectedStatus && <DocumentStatus status={selectedStatus} className="[&>svg]:mr-1.5" />}
        options={selectableStatuses.map((value) => ({
          value,
          label: <DocumentStatus status={value} />,
          trailing: formatStatsCount(stats[value]),
        }))}
        testId="documents-table-status-filter"
      />

      {/* Visually hidden document counts, for screen readers and tests. */}
      <span className="sr-only" data-testid="documents-status-counts">
        {[...selectableStatuses, ExtendedDocumentStatus.ALL].map((value) => (
          <span key={value}>
            {_(FRIENDLY_STATUS_MAP[value].label)}:{' '}
            <span data-testid={`documents-status-count-${value}`}>{stats[value]}</span>
          </span>
        ))}
      </span>
    </>
  );
};

const SELECTABLE_STATUSES: ExtendedDocumentStatus[] = [
  ExtendedDocumentStatus.INBOX,
  ExtendedDocumentStatus.PENDING,
  ExtendedDocumentStatus.COMPLETED,
  ExtendedDocumentStatus.CANCELLED,
  ExtendedDocumentStatus.DRAFT,
  ExtendedDocumentStatus.REJECTED,
  ExtendedDocumentStatus.EXPIRED,
];

const formatStatsCount = (count: number) => {
  return count >= STATS_COUNT_CAP ? `${STATS_COUNT_CAP.toLocaleString()}+` : count.toString();
};
