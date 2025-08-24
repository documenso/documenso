import { router } from '../trpc';
import { createDocumentRoute } from './create-document';
import { createDocumentTemporaryRoute } from './create-document-temporary';
import { deleteDocumentRoute } from './delete-document';
import { distributeDocumentRoute } from './distribute-document';
import { downloadDocumentRoute } from './download-document';
import { downloadDocumentAuditLogsRoute } from './download-document-audit-logs';
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

  // Temporary v2 beta routes to be removed once V2 is fully released.
  download: downloadDocumentRoute,
  createDocumentTemporary: createDocumentTemporaryRoute,

  // Internal document routes for custom frontend requests.
  getDocumentByToken: getDocumentByTokenRoute,
  findDocumentsInternal: findDocumentsInternalRoute,

  auditLog: {
    find: findDocumentAuditLogsRoute,
    download: downloadDocumentAuditLogsRoute,
  },
  inbox: router({
    find: findInboxRoute,
    getCount: getInboxCountRoute,
  }),
});
