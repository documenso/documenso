import { router } from '../trpc';
import { accessAuthRequest2FAEmailRoute } from './access-auth-request-2fa-email';
import { createAttachmentRoute } from './attachment/create-attachment';
import { deleteAttachmentRoute } from './attachment/delete-attachment';
import { findAttachmentsRoute } from './attachment/find-attachments';
import { updateAttachmentRoute } from './attachment/update-attachment';
import { createDocumentRoute } from './create-document';
import { createDocumentTemporaryRoute } from './create-document-temporary';
import { deleteDocumentRoute } from './delete-document';
import { distributeDocumentRoute } from './distribute-document';
import { downloadDocumentRoute } from './download-document';
import { downloadDocumentAuditLogsRoute } from './download-document-audit-logs';
import { downloadDocumentBetaRoute } from './download-document-beta';
import { downloadDocumentCertificateRoute } from './download-document-certificate';
import { duplicateDocumentRoute } from './duplicate-document';
import { findDocumentAuditLogsRoute } from './find-document-audit-logs';
import { findDocumentsRoute } from './find-documents';
import { findDocumentsInternalRoute } from './find-documents-internal';
import { findInboxRoute } from './find-inbox';
import { getDocumentRoute } from './get-document';
import { getDocumentByTokenRoute } from './get-document-by-token';
import { getInboxCountRoute } from './get-inbox-count';
import { redistributeDocumentRoute } from './redistribute-document';
import { searchDocumentRoute } from './search-document';
import { shareDocumentRoute } from './share-document';
import { updateDocumentRoute } from './update-document';

export const documentRouter = router({
  get: getDocumentRoute,
  find: findDocumentsRoute,
  create: createDocumentRoute,
  update: updateDocumentRoute,
  delete: deleteDocumentRoute,
  duplicate: duplicateDocumentRoute,
  downloadCertificate: downloadDocumentCertificateRoute,
  distribute: distributeDocumentRoute,
  redistribute: redistributeDocumentRoute,
  search: searchDocumentRoute,
  share: shareDocumentRoute,

  download: downloadDocumentRoute,

  // Deprecated endpoints which need to be removed in the future.
  downloadBeta: downloadDocumentBetaRoute,
  createDocumentTemporary: createDocumentTemporaryRoute,

  // Internal document routes for custom frontend requests.
  getDocumentByToken: getDocumentByTokenRoute,
  findDocumentsInternal: findDocumentsInternalRoute,

  accessAuth: router({
    request2FAEmail: accessAuthRequest2FAEmailRoute,
  }),

  auditLog: {
    find: findDocumentAuditLogsRoute,
    download: downloadDocumentAuditLogsRoute,
  },
  inbox: router({
    find: findInboxRoute,
    getCount: getInboxCountRoute,
  }),
  attachment: {
    create: createAttachmentRoute,
    update: updateAttachmentRoute,
    delete: deleteAttachmentRoute,
    find: findAttachmentsRoute,
  },
});
