import { DocumentStatus, FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateFieldAuth } from '@documenso/lib/server-only/document/validate-field-auth';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZSignEnvelopeFieldRequestSchema,
  ZSignEnvelopeFieldResponseSchema,
} from './sign-envelope-field.types';

// Note that this is an unauthenticated public procedure route.
export const signEnvelopeFieldRoute = procedure
  .input(ZSignEnvelopeFieldRequestSchema)
  .output(ZSignEnvelopeFieldResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, metadata } = ctx;
    const { token, fieldId, fieldValue, authOptions } = input;

    ctx.logger.info({
      input: {
        fieldId,
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        token,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const field = await prisma.field.findFirstOrThrow({
      where: {
        id: fieldId,
        recipient: {
          ...(recipient.role !== RecipientRole.ASSISTANT
            ? {
                id: recipient.id,
              }
            : {
                signingStatus: {
                  not: SigningStatus.SIGNED,
                },
                signingOrder: {
                  gte: recipient.signingOrder ?? 0,
                },
              }),
        },
      },
      include: {
        envelope: {
          include: {
            recipients: true,
            documentMeta: true,
          },
        },
        recipient: true,
      },
    });

    const { envelope } = field;
    const { documentMeta } = envelope;

    if (!envelope || !recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Document not found for field ${field.id}`,
      });
    }

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Envelope ${envelope.id} is not a version 2 envelope`,
      });
    }

    if (fieldValue.type !== field.type) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Selected values do not match the field values',
      });
    }

    if (envelope.deletedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} has been deleted`,
      });
    }

    if (envelope.status !== DocumentStatus.PENDING) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Document ${envelope.id} must be pending for signing`,
      });
    }

    if (
      recipient.signingStatus === SigningStatus.SIGNED ||
      field.recipient.signingStatus === SigningStatus.SIGNED
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${recipient.id} has already signed`,
      });
    }

    // Todo: Envelopes - Need to auto insert read only fields during sealing.
    if (field.fieldMeta?.readOnly) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Field ${fieldId} is read only`,
      });
    }

    // Unreachable code based on the above query but we need to satisfy TypeScript
    if (field.recipientId === null) {
      throw new Error(`Field ${fieldId} has no recipientId`);
    }

    let signatureImageAsBase64: string | null = null;
    let typedSignature: string | null = null;

    const insertionValues: { customText: string; inserted: boolean } = match(fieldValue)
      .with({ type: FieldType.EMAIL }, (fieldValue) => {
        const parsedEmailValue = z.string().email().nullable().safeParse(fieldValue.value);

        if (!parsedEmailValue.success) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid email',
          });
        }

        if (parsedEmailValue.data === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        return {
          customText: parsedEmailValue.data,
          inserted: true,
        };
      })
      .with({ type: P.union(FieldType.NAME, FieldType.INITIALS) }, (fieldValue) => {
        const parsedGenericStringValue = z.string().min(1).nullable().safeParse(fieldValue.value);

        if (!parsedGenericStringValue.success) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Value is required',
          });
        }

        if (parsedGenericStringValue.data === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        return {
          customText: parsedGenericStringValue.data,
          inserted: true,
        };
      })
      .with({ type: FieldType.DATE }, (fieldValue) => {
        if (!fieldValue.value) {
          return {
            customText: '',
            inserted: false,
          };
        }

        return {
          customText: DateTime.now()
            .setZone(documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
            .toFormat(documentMeta.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT),
          inserted: true,
        };
      })
      .with({ type: FieldType.NUMBER }, (fieldValue) => {
        if (!fieldValue.value) {
          return {
            customText: '',
            inserted: false,
          };
        }

        const numberFieldParsedMeta = ZNumberFieldMeta.parse(field.fieldMeta);
        const errors = validateNumberField(
          fieldValue.value.toString(),
          numberFieldParsedMeta,
          true,
        );

        // Todo
        if (errors.length > 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid number',
          });
        }

        return {
          customText: fieldValue.value.toString(),
          inserted: true,
        };
      })
      .with({ type: FieldType.TEXT }, (fieldValue) => {
        if (fieldValue.value === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        const parsedTextFieldMeta = ZTextFieldMeta.parse(field.fieldMeta);
        const errors = validateTextField(fieldValue.value, parsedTextFieldMeta, true);

        // Todo
        if (errors.length > 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid email',
          });
        }

        return {
          customText: fieldValue.value,
          inserted: true,
        };
      })
      .with({ type: FieldType.RADIO }, (fieldValue) => {
        if (fieldValue.value === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        const parsedRadioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
        const errors = validateRadioField(fieldValue.value, parsedRadioFieldParsedMeta, true);

        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }

        // Todo
        if (errors.length > 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid radio value',
          });
        }

        return {
          customText: fieldValue.value,
          inserted: true,
        };
      })
      .with({ type: FieldType.CHECKBOX }, (fieldValue) => {
        if (fieldValue.value === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        // Todo: Envelopes - This won't work.

        const parsedCheckboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);

        const checkboxFieldValues = parsedCheckboxFieldParsedMeta.values || [];

        const { value } = fieldValue;

        const selectedValues = checkboxFieldValues.filter(({ id }) => value.some((v) => v === id));

        if (selectedValues.length !== value.length) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Selected values do not match the checkbox field values',
          });
        }

        const errors = validateCheckboxField(
          selectedValues.map(({ value }) => value),
          parsedCheckboxFieldParsedMeta,
          true,
        );

        if (errors.length > 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid checkbox value:' + errors.join(', '),
          });
        }

        return {
          customText: JSON.stringify(fieldValue.value),
          inserted: true,
        };
      })
      .with({ type: FieldType.DROPDOWN }, (fieldValue) => {
        if (fieldValue.value === null) {
          return {
            customText: '',
            inserted: false,
          };
        }

        const parsedDropdownFieldMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
        const errors = validateDropdownField(fieldValue.value, parsedDropdownFieldMeta, true);

        // Todo
        if (errors.length > 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid dropdown value',
          });
        }

        return {
          customText: fieldValue.value,
          inserted: true,
        };
      })
      .with({ type: FieldType.SIGNATURE }, (fieldValue) => {
        const { value, isBase64 } = fieldValue;

        if (!value) {
          return {
            customText: '',
            inserted: false,
          };
        }

        signatureImageAsBase64 = isBase64 ? value : null;
        typedSignature = !isBase64 ? value : null;

        if (documentMeta.typedSignatureEnabled === false && typedSignature) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Typed signatures are not allowed. Please draw your signature',
          });
        }

        return {
          customText: '',
          inserted: true,
        };
      })
      .exhaustive();

    const derivedRecipientActionAuth = await validateFieldAuth({
      documentAuthOptions: envelope.authOptions,
      recipient,
      field,
      userId: user?.id,
      authOptions,
    });

    const assistant = recipient.role === RecipientRole.ASSISTANT ? recipient : undefined;

    return await prisma.$transaction(async (tx) => {
      const updatedField = await tx.field.update({
        where: {
          id: field.id,
        },
        data: {
          customText: insertionValues.customText,
          inserted: insertionValues.inserted,
        },
        include: {
          signature: true,
        },
      });

      if (field.type === FieldType.SIGNATURE) {
        const signature = await tx.signature.upsert({
          where: {
            fieldId: field.id,
          },
          create: {
            fieldId: field.id,
            recipientId: field.recipientId,
            signatureImageAsBase64: signatureImageAsBase64,
            typedSignature: typedSignature,
          },
          update: {
            signatureImageAsBase64: signatureImageAsBase64,
            typedSignature: typedSignature,
          },
        });

        // Dirty but I don't want to deal with type information
        Object.assign(updatedField, {
          signature,
        });
      }

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type:
            assistant && field.recipientId !== assistant.id
              ? DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_PREFILLED
              : DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
          envelopeId: envelope.id,
          user: {
            email: assistant?.email ?? recipient.email,
            name: assistant?.name ?? recipient.name,
          },
          requestMetadata: metadata.requestMetadata,
          data: {
            recipientEmail: recipient.email,
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientRole: recipient.role,
            fieldId: updatedField.secondaryId,
            field: match(updatedField.type)
              .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, (type) => ({
                type,
                data: signatureImageAsBase64 || typedSignature || '',
              }))
              .with(
                FieldType.DATE,
                FieldType.EMAIL,
                FieldType.NAME,
                FieldType.TEXT,
                FieldType.INITIALS,
                (type) => ({
                  type,
                  data: updatedField.customText,
                }),
              )
              .with(
                FieldType.NUMBER,
                FieldType.RADIO,
                FieldType.CHECKBOX,
                FieldType.DROPDOWN,
                (type) => ({
                  type,
                  data: updatedField.customText,
                }),
              )
              .exhaustive(),
            fieldSecurity: derivedRecipientActionAuth
              ? {
                  type: derivedRecipientActionAuth,
                }
              : undefined,
          },
        }),
      });

      return {
        signedField: updatedField,
      };
    });
  });
