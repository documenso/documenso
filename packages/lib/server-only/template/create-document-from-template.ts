import type { DocumentDistributionMethod, DocumentSigningOrder } from '@prisma/client';
import {
  DocumentSource,
  EnvelopeType,
  type Field,
  FolderType,
  type Recipient,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '../../constants/date-formats';
import type { SupportedLanguageCodes } from '../../constants/i18n';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import type { TDocumentEmailSettings } from '../../types/document-email';
import type {
  TCheckboxFieldMeta,
  TDropdownFieldMeta,
  TFieldMetaPrefillFieldsSchema,
  TNumberFieldMeta,
  TRadioFieldMeta,
  TTextFieldMeta,
} from '../../types/field-meta';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZRadioFieldMeta,
} from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { extractDerivedDocumentMeta } from '../../utils/document';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { incrementDocumentId } from '../envelope/increment-id';
import { getTeamSettings } from '../team/get-team-settings';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

type FinalRecipient = Pick<
  Recipient,
  'name' | 'email' | 'role' | 'authOptions' | 'signingOrder' | 'token'
> & {
  templateRecipientId: number;
  fields: Field[];
};

export type CreateDocumentFromTemplateOptions = {
  id: EnvelopeIdOptions;
  externalId?: string | null;
  userId: number;
  teamId: number;
  recipients: {
    id: number;
    name?: string;
    email: string;
    signingOrder?: number | null;
  }[];
  folderId?: string;
  prefillFields?: TFieldMetaPrefillFieldsSchema[];

  customDocumentData?: {
    documentDataId: string;

    /**
     * The envelope item ID which will be updated to use the custom document data.
     *
     * If undefined, will use the first envelope item. This is done for backwards compatibility reasons.
     */
    envelopeItemId?: string;
  }[];

  attachments?: Array<{
    label: string;
    data: string;
    type?: 'link';
  }>;

  /**
   * Values that will override the predefined values in the template.
   */
  override?: {
    title?: string;
    subject?: string;
    message?: string;
    timezone?: string;
    password?: string;
    dateFormat?: string;
    redirectUrl?: string;
    signingOrder?: DocumentSigningOrder;
    language?: SupportedLanguageCodes;
    distributionMethod?: DocumentDistributionMethod;
    allowDictateNextSigner?: boolean;
    emailSettings?: TDocumentEmailSettings;
    typedSignatureEnabled?: boolean;
    uploadSignatureEnabled?: boolean;
    drawSignatureEnabled?: boolean;
  };
  requestMetadata: ApiRequestMetadata;
};

const getUpdatedFieldMeta = (field: Field, prefillField?: TFieldMetaPrefillFieldsSchema) => {
  if (!prefillField) {
    return field.fieldMeta;
  }

  const advancedField = ['NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'TEXT'].includes(field.type);

  if (!advancedField) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Field ${field.id} is not an advanced field and cannot have field meta information. Allowed types: NUMBER, RADIO, CHECKBOX, DROPDOWN, TEXT.`,
    });
  }

  // We've already validated that the field types match at a higher level
  // Start with the existing field meta or an empty object
  const existingMeta = field.fieldMeta || {};

  // Apply type-specific updates based on the prefill field type using ts-pattern
  return match(prefillField)
    .with({ type: 'text' }, (field) => {
      if (typeof field.value !== 'string') {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid value for TEXT field ${field.id}: expected string, got ${typeof field.value}`,
        });
      }

      const meta: TTextFieldMeta = {
        ...existingMeta,
        type: 'text',
        label: field.label,
        placeholder: field.placeholder,
        text: field.value,
      };

      return meta;
    })
    .with({ type: 'number' }, (field) => {
      if (typeof field.value !== 'string') {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid value for NUMBER field ${field.id}: expected string, got ${typeof field.value}`,
        });
      }

      const meta: TNumberFieldMeta = {
        ...existingMeta,
        type: 'number',
        label: field.label,
        placeholder: field.placeholder,
        value: field.value,
      };

      return meta;
    })
    .with({ type: 'radio' }, (field) => {
      if (typeof field.value !== 'string') {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid value for RADIO field ${field.id}: expected string, got ${typeof field.value}`,
        });
      }

      const result = ZRadioFieldMeta.safeParse(existingMeta);

      if (!result.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid field meta for RADIO field ${field.id}`,
        });
      }

      const radioMeta = result.data;

      // Validate that the value exists in the options
      const valueExists = radioMeta.values?.some((option) => option.value === field.value);

      if (!valueExists) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Value "${field.value}" not found in options for RADIO field ${field.id}`,
        });
      }

      const newValues = radioMeta.values?.map((option) => ({
        ...option,
        checked: option.value === field.value,
      }));

      const meta: TRadioFieldMeta = {
        ...existingMeta,
        type: 'radio',
        label: field.label,
        values: newValues,
        direction: radioMeta.direction ?? 'vertical',
      };

      return meta;
    })
    .with({ type: 'checkbox' }, (field) => {
      const result = ZCheckboxFieldMeta.safeParse(existingMeta);

      if (!result.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid field meta for CHECKBOX field ${field.id}`,
        });
      }

      const checkboxMeta = result.data;

      if (!field.value) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Value is required for CHECKBOX field ${field.id}`,
        });
      }

      const fieldValue = field.value;

      // Validate that all values exist in the options
      for (const value of fieldValue) {
        const valueExists = checkboxMeta.values?.some((option) => option.value === value);

        if (!valueExists) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: `Value "${value}" not found in options for CHECKBOX field ${field.id}`,
          });
        }
      }

      const newValues = checkboxMeta.values?.map((option) => ({
        ...option,
        checked: fieldValue.includes(option.value),
      }));

      const meta: TCheckboxFieldMeta = {
        ...existingMeta,
        type: 'checkbox',
        label: field.label,
        values: newValues,
        direction: checkboxMeta.direction ?? 'vertical',
      };

      return meta;
    })
    .with({ type: 'dropdown' }, (field) => {
      const result = ZDropdownFieldMeta.safeParse(existingMeta);

      if (!result.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Invalid field meta for DROPDOWN field ${field.id}`,
        });
      }

      const dropdownMeta = result.data;

      // Validate that the value exists in the options if values are defined
      const valueExists = dropdownMeta.values?.some((option) => option.value === field.value);

      if (!valueExists) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `Value "${field.value}" not found in options for DROPDOWN field ${field.id}`,
        });
      }

      const meta: TDropdownFieldMeta = {
        ...existingMeta,
        type: 'dropdown',
        label: field.label,
        defaultValue: field.value,
      };

      return meta;
    })
    .otherwise(() => field.fieldMeta);
};

export const createDocumentFromTemplate = async ({
  id,
  externalId,
  userId,
  teamId,
  recipients,
  customDocumentData = [],
  override,
  requestMetadata,
  folderId,
  prefillFields,
  attachments,
}: CreateDocumentFromTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const template = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: {
        include: {
          fields: true,
        },
      },
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      documentMeta: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: {
        id: folderId,
        type: FolderType.DOCUMENT,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  const legacyTemplateId = mapSecondaryIdToTemplateId(template.secondaryId);
  const finalEnvelopeTitle = override?.title || template.title;

  if (template.envelopeItems.length < 1) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Template must have at least 1 envelope item',
    });
  }

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  // Check that all the passed in recipient IDs can be associated with a template recipient.
  recipients.forEach((recipient) => {
    const foundRecipient = template.recipients.find(
      (templateRecipient) => templateRecipient.id === recipient.id,
    );

    if (!foundRecipient) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient with ID ${recipient.id} not found in the template.`,
      });
    }
  });

  const { documentAuthOption: templateAuthOptions } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const finalRecipients: FinalRecipient[] = template.recipients.map((templateRecipient) => {
    const foundRecipient = recipients.find((recipient) => recipient.id === templateRecipient.id);

    return {
      templateRecipientId: templateRecipient.id,
      fields: templateRecipient.fields,
      name: foundRecipient ? (foundRecipient.name ?? '') : templateRecipient.name,
      email: foundRecipient ? foundRecipient.email : templateRecipient.email,
      role: templateRecipient.role,
      signingOrder: foundRecipient?.signingOrder ?? templateRecipient.signingOrder,
      authOptions: templateRecipient.authOptions,
      token: nanoid(),
    };
  });

  // Key = original envelope item ID
  // Value = duplicated envelope item ID.
  const oldEnvelopeItemToNewEnvelopeItemIdMap: Record<string, string> = {};

  // Duplicate the envelope item data.
  // Note: This is duplicated in createDocumentFromDirectTemplate
  const envelopeItemsToCreate = await Promise.all(
    template.envelopeItems.map(async (item, i) => {
      let documentDataIdToDuplicate = item.documentDataId;

      const foundCustomDocumentData = customDocumentData.find((customDocumentDataItem) => {
        // Handle empty envelopeItemId for backwards compatibility reasons.
        if (customDocumentDataItem.documentDataId && !customDocumentDataItem.envelopeItemId) {
          return true;
        }

        return customDocumentDataItem.envelopeItemId === item.id;
      });

      if (foundCustomDocumentData) {
        documentDataIdToDuplicate = foundCustomDocumentData.documentDataId;
      }

      const documentDataToDuplicate = await prisma.documentData.findFirst({
        where: {
          id: documentDataIdToDuplicate,
        },
      });

      if (!documentDataToDuplicate) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Document data not found',
        });
      }

      const buffer = await getFileServerSide(documentDataToDuplicate);

      const titleToUse = item.title || finalEnvelopeTitle;

      const duplicatedFile = await putPdfFileServerSide({
        name: titleToUse,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(buffer),
      });

      const newDocumentData = await prisma.documentData.create({
        data: {
          type: duplicatedFile.type,
          data: duplicatedFile.data,
          initialData: duplicatedFile.initialData,
        },
      });

      const newEnvelopeItemId = prefixedId('envelope_item');

      oldEnvelopeItemToNewEnvelopeItemIdMap[item.id] = newEnvelopeItemId;

      return {
        id: newEnvelopeItemId,
        title: titleToUse.endsWith('.pdf') ? titleToUse.slice(0, -4) : titleToUse,
        documentDataId: newDocumentData.id,
        order: item.order !== undefined ? item.order : i + 1,
      };
    }),
  );

  const incrementedDocumentId = await incrementDocumentId();

  const documentMeta = await prisma.documentMeta.create({
    data: extractDerivedDocumentMeta(settings, {
      subject: override?.subject || template.documentMeta?.subject,
      message: override?.message || template.documentMeta?.message,
      timezone: override?.timezone || template.documentMeta?.timezone,
      dateFormat: override?.dateFormat || template.documentMeta?.dateFormat,
      redirectUrl: override?.redirectUrl || template.documentMeta?.redirectUrl,
      distributionMethod: override?.distributionMethod || template.documentMeta?.distributionMethod,
      emailSettings: override?.emailSettings || template.documentMeta?.emailSettings,
      signingOrder: override?.signingOrder || template.documentMeta?.signingOrder,
      language: override?.language || template.documentMeta?.language || settings.documentLanguage,
      typedSignatureEnabled:
        override?.typedSignatureEnabled ?? template.documentMeta?.typedSignatureEnabled,
      uploadSignatureEnabled:
        override?.uploadSignatureEnabled ?? template.documentMeta?.uploadSignatureEnabled,
      drawSignatureEnabled:
        override?.drawSignatureEnabled ?? template.documentMeta?.drawSignatureEnabled,
      allowDictateNextSigner:
        override?.allowDictateNextSigner ?? template.documentMeta?.allowDictateNextSigner,
    }),
  });

  return await prisma.$transaction(async (tx) => {
    const envelope = await tx.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: incrementedDocumentId.formattedDocumentId,
        type: EnvelopeType.DOCUMENT,
        internalVersion: template.internalVersion,
        qrToken: prefixedId('qr'),
        source: DocumentSource.TEMPLATE,
        externalId: externalId || template.externalId,
        templateId: legacyTemplateId, // The template this envelope was created from.
        userId,
        folderId,
        teamId: template.teamId,
        title: finalEnvelopeTitle,
        envelopeItems: {
          createMany: {
            data: envelopeItemsToCreate,
          },
        },
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: templateAuthOptions.globalAccessAuth,
          globalActionAuth: templateAuthOptions.globalActionAuth,
        }),
        visibility: template.visibility || settings.documentVisibility,
        useLegacyFieldInsertion: template.useLegacyFieldInsertion ?? false,
        documentMetaId: documentMeta.id,
        recipients: {
          createMany: {
            data: finalRecipients.map((recipient) => {
              const authOptions = ZRecipientAuthOptionsSchema.parse(recipient?.authOptions);

              return {
                email: recipient.email,
                name: recipient.name,
                role: recipient.role,
                authOptions: createRecipientAuthOptions({
                  accessAuth: authOptions.accessAuth,
                  actionAuth: authOptions.actionAuth,
                }),
                sendStatus:
                  recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
                signingStatus:
                  recipient.role === RecipientRole.CC
                    ? SigningStatus.SIGNED
                    : SigningStatus.NOT_SIGNED,
                signingOrder: recipient.signingOrder,
                token: recipient.token,
              };
            }),
          },
        },
      },
      include: {
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        envelopeItems: {
          select: {
            id: true,
          },
        },
      },
    });

    let fieldsToCreate: Omit<Field, 'id' | 'secondaryId'>[] = [];

    // Get all template field IDs first so we can validate later
    const allTemplateFieldIds = finalRecipients.flatMap((recipient) =>
      recipient.fields.map((field) => field.id),
    );

    if (prefillFields?.length) {
      // Validate that all prefill field IDs exist in the template
      const invalidFieldIds = prefillFields
        .map((prefillField) => prefillField.id)
        .filter((id) => !allTemplateFieldIds.includes(id));

      if (invalidFieldIds.length > 0) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: `The following field IDs do not exist in the template: ${invalidFieldIds.join(', ')}`,
        });
      }

      // Validate that all prefill fields have the correct type
      for (const prefillField of prefillFields) {
        const templateField = finalRecipients
          .flatMap((recipient) => recipient.fields)
          .find((field) => field.id === prefillField.id);

        if (!templateField) {
          // This should never happen due to the previous validation, but just in case
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: `Field with ID ${prefillField.id} not found in the template`,
          });
        }

        const expectedType = templateField.type.toLowerCase();
        const actualType = prefillField.type;

        if (expectedType !== actualType) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: `Field type mismatch for field ${prefillField.id}: expected ${expectedType}, got ${actualType}`,
          });
        }
      }
    }

    Object.values(finalRecipients).forEach(({ token, fields }) => {
      const recipient = envelope.recipients.find((recipient) => recipient.token === token);

      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      fieldsToCreate = fieldsToCreate.concat(
        fields.map((field) => {
          const prefillField = prefillFields?.find((value) => value.id === field.id);

          const payload = {
            envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[field.envelopeItemId],
            envelopeId: envelope.id,
            recipientId: recipient.id,
            type: field.type,
            page: field.page,
            positionX: field.positionX,
            positionY: field.positionY,
            width: field.width,
            height: field.height,
            customText: '',
            inserted: false,
            fieldMeta: field.fieldMeta,
          };

          if (prefillField) {
            match(prefillField)
              .with({ type: 'date' }, (selector) => {
                if (!selector.value) {
                  throw new AppError(AppErrorCode.INVALID_BODY, {
                    message: `Date value is required for field ${field.id}`,
                  });
                }

                const date = new Date(selector.value);

                if (isNaN(date.getTime())) {
                  throw new AppError(AppErrorCode.INVALID_BODY, {
                    message: `Invalid date value for field ${field.id}: ${selector.value}`,
                  });
                }

                payload.customText = DateTime.fromJSDate(date).toFormat(
                  template.documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
                );

                payload.inserted = true;
              })
              .otherwise((selector) => {
                payload.fieldMeta = getUpdatedFieldMeta(field, selector);
              });
          }

          return payload;
        }),
      );
    });

    await tx.field.createMany({
      data: fieldsToCreate.map((field) => ({
        ...field,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      })),
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          title: envelope.title,
          source: {
            type: DocumentSource.TEMPLATE,
            templateId: legacyTemplateId,
          },
        },
      }),
    });

    const templateAttachments = await tx.envelopeAttachment.findMany({
      where: {
        envelopeId: template.id,
      },
    });

    const attachmentsToCreate = [
      ...templateAttachments.map((attachment) => ({
        envelopeId: envelope.id,
        type: attachment.type,
        label: attachment.label,
        data: attachment.data,
      })),
      ...(attachments || []).map((attachment) => ({
        envelopeId: envelope.id,
        type: attachment.type || 'link',
        label: attachment.label,
        data: attachment.data,
      })),
    ];

    if (attachmentsToCreate.length > 0) {
      await tx.envelopeAttachment.createMany({
        data: attachmentsToCreate,
      });
    }

    const createdEnvelope = await tx.envelope.findFirst({
      where: {
        id: envelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    if (!createdEnvelope) {
      throw new Error('Document not found');
    }

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(createdEnvelope)),
      userId,
      teamId,
    });

    return envelope;
  });
};
