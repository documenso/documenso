import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import type { WebhookPayload } from '../../../types/webhook-payload';

export const generateSampleWebhookPayload = (
  event: WebhookTriggerEvents,
  webhookUrl: string,
): WebhookPayload => {
  const now = new Date();
  const basePayload = {
    id: 10,
    externalId: null,
    userId: 1,
    authOptions: null,
    formValues: null,
    visibility: DocumentVisibility.EVERYONE,
    title: 'documenso.pdf',
    status: DocumentStatus.DRAFT,
    documentDataId: 'hs8qz1ktr9204jn7mg6c5dxy0',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null,
    teamId: null,
    templateId: null,
    source: DocumentSource.DOCUMENT,
    documentMeta: {
      id: 'doc_meta_123',
      subject: 'Please sign this document',
      message: 'Hello, please review and sign this document.',
      timezone: 'UTC',
      password: null,
      dateFormat: 'MM/DD/YYYY',
      redirectUrl: null,
      signingOrder: DocumentSigningOrder.PARALLEL,
      allowDictateNextSigner: false,
      typedSignatureEnabled: true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
      language: 'en',
      distributionMethod: DocumentDistributionMethod.EMAIL,
      emailSettings: null,
    },
    recipients: [
      {
        id: 52,
        documentId: 10,
        templateId: null,
        email: 'signer@documenso.com',
        name: 'John Doe',
        token: 'SIGNING_TOKEN',
        documentDeletedAt: null,
        expired: null,
        signedAt: null,
        authOptions: null,
        signingOrder: 1,
        rejectionReason: null,
        role: RecipientRole.SIGNER,
        readStatus: ReadStatus.NOT_OPENED,
        signingStatus: SigningStatus.NOT_SIGNED,
        sendStatus: SendStatus.NOT_SENT,
      },
    ],
    Recipient: [
      {
        id: 52,
        documentId: 10,
        templateId: null,
        email: 'signer@documenso.com',
        name: 'John Doe',
        token: 'SIGNING_TOKEN',
        documentDeletedAt: null,
        expired: null,
        signedAt: null,
        authOptions: null,
        signingOrder: 1,
        rejectionReason: null,
        role: RecipientRole.SIGNER,
        readStatus: ReadStatus.NOT_OPENED,
        signingStatus: SigningStatus.NOT_SIGNED,
        sendStatus: SendStatus.NOT_SENT,
      },
    ],
  };

  if (event === WebhookTriggerEvents.DOCUMENT_CREATED) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.DRAFT,
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_SENT) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.PENDING,
        recipients: [
          {
            ...basePayload.recipients[0],
            email: 'signer2@documenso.com',
            name: 'Signer 2',
            role: RecipientRole.VIEWER,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: null,
            signingOrder: 1,
            rejectionReason: null,
            readStatus: ReadStatus.NOT_OPENED,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
        Recipient: [
          {
            ...basePayload.Recipient[0],
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            signingOrder: 2,
            role: RecipientRole.SIGNER,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: null,
            rejectionReason: null,
            readStatus: ReadStatus.NOT_OPENED,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_OPENED) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.PENDING,
        recipients: [
          {
            ...basePayload.recipients[0],
            email: 'signer2@documenso.com',
            name: 'Signer 2',
            role: RecipientRole.VIEWER,
            readStatus: ReadStatus.OPENED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: null,
            signingOrder: 1,
            rejectionReason: null,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
        Recipient: [
          {
            ...basePayload.Recipient[0],
            email: 'signer2@documenso.com',
            name: 'Signer 2',
            role: RecipientRole.VIEWER,
            readStatus: ReadStatus.OPENED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: null,
            signingOrder: 1,
            rejectionReason: null,
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_SIGNED) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.COMPLETED,
        completedAt: now,
        recipients: [
          {
            ...basePayload.recipients[0],
            id: 51,
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signingOrder: 1,
            rejectionReason: null,
          },
        ],
        Recipient: [
          {
            ...basePayload.Recipient[0],
            id: 51,
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signingOrder: 1,
            rejectionReason: null,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_COMPLETED) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.COMPLETED,
        completedAt: now,
        recipients: [
          {
            id: 50,
            documentId: 10,
            templateId: null,
            email: 'signer2@documenso.com',
            name: 'Signer 2',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 1,
            rejectionReason: null,
            role: RecipientRole.VIEWER,
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
          },
          {
            id: 51,
            documentId: 10,
            templateId: null,
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 2,
            rejectionReason: null,
            role: RecipientRole.SIGNER,
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
          },
        ],
        Recipient: [
          {
            id: 50,
            documentId: 10,
            templateId: null,
            email: 'signer2@documenso.com',
            name: 'Signer 2',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 1,
            rejectionReason: null,
            role: RecipientRole.VIEWER,
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
          },
          {
            id: 51,
            documentId: 10,
            templateId: null,
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 2,
            rejectionReason: null,
            role: RecipientRole.SIGNER,
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.SIGNED,
            sendStatus: SendStatus.SENT,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_REJECTED) {
    return {
      event,
      payload: {
        ...basePayload,
        status: DocumentStatus.PENDING,
        recipients: [
          {
            ...basePayload.recipients[0],
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            rejectionReason: 'I do not agree with the terms',
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.REJECTED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signingOrder: 1,
          },
        ],
        Recipient: [
          {
            ...basePayload.Recipient[0],
            signedAt: now,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            rejectionReason: 'I do not agree with the terms',
            readStatus: ReadStatus.OPENED,
            signingStatus: SigningStatus.REJECTED,
            sendStatus: SendStatus.SENT,
            documentDeletedAt: null,
            expired: null,
            signingOrder: 1,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  if (event === WebhookTriggerEvents.DOCUMENT_CANCELLED) {
    return {
      event,
      payload: {
        ...basePayload,
        id: 7,
        externalId: null,
        userId: 3,
        status: DocumentStatus.PENDING,
        documentMeta: {
          ...basePayload.documentMeta,
          id: 'cm6exvn96006ji02rqvzjvwoy',
          subject: '',
          message: '',
          timezone: 'Etc/UTC',
          dateFormat: 'yyyy-MM-dd hh:mm a',
          redirectUrl: '',
          emailSettings: {
            documentDeleted: true,
            documentPending: true,
            recipientSigned: true,
            recipientRemoved: true,
            documentCompleted: true,
            ownerDocumentCompleted: true,
            recipientSigningRequest: true,
          },
        },
        recipients: [
          {
            id: 7,
            documentId: 7,
            templateId: null,
            email: 'signer1@documenso.com',
            name: 'Signer 1',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 1,
            rejectionReason: null,
            role: RecipientRole.SIGNER,
            readStatus: ReadStatus.NOT_OPENED,
            signingStatus: SigningStatus.NOT_SIGNED,
            sendStatus: SendStatus.SENT,
          },
        ],
        Recipient: [
          {
            id: 7,
            documentId: 7,
            templateId: null,
            email: 'signer@documenso.com',
            name: 'Signer',
            token: 'SIGNING_TOKEN',
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: {
              accessAuth: null,
              actionAuth: null,
            },
            signingOrder: 1,
            rejectionReason: null,
            role: RecipientRole.SIGNER,
            readStatus: ReadStatus.NOT_OPENED,
            signingStatus: SigningStatus.NOT_SIGNED,
            sendStatus: SendStatus.SENT,
          },
        ],
      },
      createdAt: now.toISOString(),
      webhookEndpoint: webhookUrl,
    };
  }

  throw new Error(`Unsupported event type: ${event}`);
};
