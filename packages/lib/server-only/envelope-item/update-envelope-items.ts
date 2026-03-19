import type { EnvelopeItem, EnvelopeType } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

type UnsafeUpdateEnvelopeItemsOptions = {
  envelopeId: string;
  envelopeType: EnvelopeType;
  existingEnvelopeItems: Pick<EnvelopeItem, 'id' | 'title' | 'order'>[];
  data: {
    envelopeItemId: string;
    order?: number;
    title?: string;
  }[];
  user: {
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

export const UNSAFE_updateEnvelopeItems = async ({
  envelopeId,
  envelopeType,
  existingEnvelopeItems,
  data,
  user,
  apiRequestMetadata,
}: UnsafeUpdateEnvelopeItemsOptions) => {
  const updatedEnvelopeItems = await Promise.all(
    data.map(async ({ envelopeItemId, order, title }) =>
      prisma.envelopeItem.update({
        where: {
          envelopeId,
          id: envelopeItemId,
        },
        data: {
          order,
          title,
        },
        select: {
          id: true,
          order: true,
          title: true,
          envelopeId: true,
        },
      }),
    ),
  );

  // Write audit logs for DOCUMENT type envelopes when changes are detected.
  if (envelopeType === 'DOCUMENT') {
    const auditLogs = data.flatMap((item) => {
      const existing = existingEnvelopeItems.find((e) => e.id === item.envelopeItemId);

      if (!existing) {
        return [];
      }

      const changes: { field: string; from: string; to: string }[] = [];

      if (item.title !== undefined && item.title !== existing.title) {
        changes.push({
          field: 'title',
          from: existing.title,
          to: item.title,
        });
      }

      if (changes.length === 0) {
        return [];
      }

      return [
        createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_UPDATED,
          envelopeId,
          data: {
            envelopeItemId: item.envelopeItemId,
            changes,
          },
          user: {
            name: user.name,
            email: user.email,
          },
          requestMetadata: apiRequestMetadata.requestMetadata,
        }),
      ];
    });

    if (auditLogs.length > 0) {
      await prisma.documentAuditLog.createMany({
        data: auditLogs,
      });
    }
  }

  return updatedEnvelopeItems;
};
