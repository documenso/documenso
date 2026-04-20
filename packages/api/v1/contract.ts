import { initContract } from '@ts-rest/core';

import {
  ZCreateTemplateV2RequestSchema,
  ZCreateTemplateV2ResponseSchema,
} from '@documenso/trpc/server/template-router/schema';

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
  ZDownloadDocumentQuerySchema,
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

const deprecatedDescription =
  'This endpoint is deprecated, but will continue to be supported. For more details, see https://docs.documenso.com/developers/public-api.';

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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
    },

    downloadSignedDocument: {
      method: 'GET',
      path: '/api/v1/documents/:id/download',
      query: ZDownloadDocumentQuerySchema,
      responses: {
        200: ZDownloadDocumentSuccessfulSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Download a signed document when the storage transport is S3',
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
    },

    createTemplate: {
      method: 'POST',
      path: '/api/v1/templates',
      body: ZCreateTemplateV2RequestSchema,
      responses: {
        200: ZCreateTemplateV2ResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new template and get a presigned URL',
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      description: `${deprecatedDescription} \n\nIf you must use the V1 API, use "/api/v1/templates/:templateId/generate-document" instead.`,
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
      deprecated: true,
      description: `${deprecatedDescription} \n\nCreate a new document from an existing template. Passing in values for title and meta will override the original values defined in the template. If you do not pass in values for recipients, it will use the values defined in the template.`,
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
      deprecated: true,
      description: `${deprecatedDescription} \n\nNotes\n\nsendEmail - Whether to send an email to the recipients asking them to action the document. If you disable this, you will need to manually distribute the document to the recipients using the generated signing links. Defaults to true`,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
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
      deprecated: true,
      description: deprecatedDescription,
    },
  },
  {
    baseHeaders: ZAuthorizationHeadersSchema,
  },
);
