import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface DeleteTemplateFieldOptions {
  userId: number;
  teamId: number;
  fieldId: number;
  force?: boolean;
}

export const deleteTemplateField = async ({
  userId,
  teamId,
  fieldId,
  force = false,
}: DeleteTemplateFieldOptions): Promise<void> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      envelope: {
        type: EnvelopeType.TEMPLATE,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  // Additional validation to check visibility.
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: field.envelopeId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  // Check for dangling visibility references.
  const deletingMeta = field.fieldMeta as { stableId?: string } | null;
  const deletingStableId = deletingMeta?.stableId;

  let danglingRefs: Array<{ id: number; fieldMeta: unknown }> = [];

  if (deletingStableId) {
    const allOtherFields = await prisma.field.findMany({
      where: {
        envelopeId: field.envelopeId,
        id: { not: field.id },
      },
      select: { id: true, fieldMeta: true },
    });

    danglingRefs = allOtherFields.filter((f) => {
      const meta = f.fieldMeta as {
        visibility?: { rules: Array<{ triggerFieldStableId: string }> };
      } | null;
      return (
        meta?.visibility?.rules.some((r) => r.triggerFieldStableId === deletingStableId) ?? false
      );
    });

    if (danglingRefs.length > 0 && !force) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Field is used as a visibility trigger by other fields. Pass force=true to strip those rules.',
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Strip dangling visibility rules from referencing fields before deletion.
    if (danglingRefs.length > 0 && force) {
      for (const ref of danglingRefs) {
        const meta = ref.fieldMeta as {
          visibility: {
            rules: Array<{ triggerFieldStableId: string }>;
            match: 'all' | 'any';
          };
        } & Record<string, unknown>;

        const remaining = meta.visibility.rules.filter(
          (r) => r.triggerFieldStableId !== deletingStableId,
        );

        const newMeta = { ...meta };

        if (remaining.length === 0) {
          delete (newMeta as Record<string, unknown>).visibility;
        } else {
          newMeta.visibility = { ...meta.visibility, rules: remaining };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.field.update({ where: { id: ref.id }, data: { fieldMeta: newMeta as any } });
      }
    }

    await tx.field.delete({
      where: {
        id: field.id,
        envelope: envelopeWhereInput,
      },
    });
  });
};
