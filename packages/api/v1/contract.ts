import { initContract } from '@ts-rest/core';

import {
  ZAuthorizationHeadersSchema,
  ZCreateDocumentFromTemplateMutationResponseSchema,
  ZCreateDocumentFromTemplateMutationSchema,
  ZCreateDocumentMutationResponseSchema,
  ZCreateDocumentMutationSchema,
  ZCreateFieldMutationSchema,
  ZCreateRecipientMutationSchema,
  ZDeleteDocumentMutationSchema,
  ZDeleteFieldMutationSchema,
  ZDeleteRecipientMutationSchema,
  ZDownloadDocumentSuccessfulSchema,
  ZGenerateDocumentFromTemplateMutationResponseSchema,
  ZGenerateDocumentFromTemplateMutationSchema,
  ZGetDocumentsQuerySchema,
  ZGetTemplatesQuerySchema,
  ZNoBodyMutationSchema,
  ZResendDocumentForSigningMutationSchema,
  ZSendDocumentForSigningMutationSchema,
  ZSuccessfulDeleteTemplateResponseSchema,
  ZSuccessfulDocumentResponseSchema,
  ZSuccessfulFieldCreationResponseSchema,
  ZSuccessfulFieldResponseSchema,
  ZSuccessfulGetDocumentResponseSchema,
  ZSuccessfulGetTemplateResponseSchema,
  ZSuccessfulGetTemplatesResponseSchema,
  ZSuccessfulRecipientResponseSchema,
  ZSuccessfulResendDocumentResponseSchema,
  ZSuccessfulResponseSchema,
  ZSuccessfulSigningResponseSchema,
  ZUnsuccessfulResponseSchema,
  ZUpdateFieldMutationSchema,
  ZUpdateRecipientMutationSchema,
} from './schema';

const c = initContract();

export const ApiContractV1 = c.router(
  {
    getDocuments: {
      method: 'GET',
      path: '/api/v1/documents',
      query: ZGetDocumentsQuerySchema,
      responses: {
        200: ZSuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all documents',
    },

    getDocument: {
      method: 'GET',
      path: '/api/v1/documents/:id',
      responses: {
        200: ZSuccessfulGetDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single document',
    },

    downloadSignedDocument: {
      method: 'GET',
      path: '/api/v1/documents/:id/download',
      responses: {
        200: ZDownloadDocumentSuccessfulSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Download a signed document when the storage transport is S3',
    },

    createDocument: {
      method: 'POST',
      path: '/api/v1/documents',
      body: ZCreateDocumentMutationSchema,
      responses: {
        200: ZCreateDocumentMutationResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Upload a new document and get a presigned URL',
    },

    deleteTemplate: {
      method: 'DELETE',
      path: '/api/v1/templates/:id',
      body: ZNoBodyMutationSchema,
      responses: {
        200: ZSuccessfulDeleteTemplateResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a template',
    },

    getTemplate: {
      method: 'GET',
      path: '/api/v1/templates/:id',
      responses: {
        200: ZSuccessfulGetTemplateResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single template',
    },

    getTemplates: {
      method: 'GET',
      path: '/api/v1/templates',
      query: ZGetTemplatesQuerySchema,
      responses: {
        200: ZSuccessfulGetTemplatesResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all templates',
    },

    createDocumentFromTemplate: {
      method: 'POST',
      path: '/api/v1/templates/:templateId/create-document',
      body: ZCreateDocumentFromTemplateMutationSchema,
      responses: {
        200: ZCreateDocumentFromTemplateMutationResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new document from an existing template',
      deprecated: true,
      description: `This has been deprecated in favour of "/api/v1/templates/:templateId/generate-document". You may face unpredictable behavior using this endpoint as it is no longer maintained.`,
    },

    generateDocumentFromTemplate: {
      method: 'POST',
      path: '/api/v1/templates/:templateId/generate-document',
      body: ZGenerateDocumentFromTemplateMutationSchema,
      responses: {
        200: ZGenerateDocumentFromTemplateMutationResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new document from an existing template',
      description:
        'Create a new document from an existing template. Passing in values for title and meta will override the original values defined in the template. If you do not pass in values for recipients, it will use the values defined in the template.',
    },

    sendDocument: {
      method: 'POST',
      path: '/api/v1/documents/:id/send',
      body: ZSendDocumentForSigningMutationSchema,
      responses: {
        200: ZSuccessfulSigningResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Send a document for signing',
    },

    resendDocument: {
      method: 'POST',
      path: '/api/v1/documents/:id/resend',
      body: ZResendDocumentForSigningMutationSchema,
      responses: {
        200: ZSuccessfulResendDocumentResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Re-send a document for signing',
    },

    deleteDocument: {
      method: 'DELETE',
      path: '/api/v1/documents/:id',
      body: ZDeleteDocumentMutationSchema,
      responses: {
        200: ZSuccessfulDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a document',
    },

    createRecipient: {
      method: 'POST',
      path: '/api/v1/documents/:id/recipients',
      body: ZCreateRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a recipient for a document',
    },

    updateRecipient: {
      method: 'PATCH',
      path: '/api/v1/documents/:id/recipients/:recipientId',
      body: ZUpdateRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Update a recipient for a document',
    },

    deleteRecipient: {
      method: 'DELETE',
      path: '/api/v1/documents/:id/recipients/:recipientId',
      body: ZDeleteRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a recipient from a document',
    },

    createField: {
      method: 'POST',
      path: '/api/v1/documents/:id/fields',
      body: ZCreateFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldCreationResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a field for a document',
    },

    updateField: {
      method: 'PATCH',
      path: '/api/v1/documents/:id/fields/:fieldId',
      body: ZUpdateFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Update a field for a document',
    },

    deleteField: {
      method: 'DELETE',
      path: '/api/v1/documents/:id/fields/:fieldId',
      body: ZDeleteFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a field from a document',
    },
  },
  {
    baseHeaders: ZAuthorizationHeadersSchema,
  },
);
