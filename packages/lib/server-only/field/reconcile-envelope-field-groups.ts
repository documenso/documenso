import type { Prisma } from '@prisma/client';

import { reconcileFieldGroupsAfterRemoval } from '../../utils/field-group-reconciliation';

type ReconcileEnvelopeFieldGroupsOptions = {
  envelopeId: string;
  tx: Prisma.TransactionClient;
};

/**
 * Keeps the groups of an envelope valid after some of their fields were removed by
 * something other than a field edit, such as a deleted file or a PDF replaced by a
 * shorter one.
 *
 * Must run in the transaction which removed the fields, after they are gone.
 */
export const reconcileEnvelopeFieldGroups = async ({ envelopeId, tx }: ReconcileEnvelopeFieldGroupsOptions) => {
  const groupedFields = await tx.field.findMany({
    where: {
      envelopeId,
      groupId: {
        not: null,
      },
    },
  });

  // Every group is checked rather than only the ones which lost a field, since those can
  // no longer be told apart once the fields are gone.
  const fieldMetaByFieldId = reconcileFieldGroupsAfterRemoval({
    remainingFields: groupedFields,
    groupIds: groupedFields.flatMap((field) => (field.groupId ? [field.groupId] : [])),
  });

  // `updateMany` so a field deleted in the meantime by another transaction is skipped
  // instead of failing this one.
  await Promise.all(
    Array.from(fieldMetaByFieldId.entries()).map(async ([fieldId, fieldMeta]) =>
      tx.field.updateMany({
        where: {
          id: fieldId,
          envelopeId,
        },
        data: {
          fieldMeta,
        },
      }),
    ),
  );
};
