import { router } from '../trpc';
import { createAttachmentRoute } from './attachment/create-attachment';
import { deleteAttachmentRoute } from './attachment/delete-attachment';
import { findAttachmentsRoute } from './attachment/find-attachments';
import { updateAttachmentRoute } from './attachment/update-attachment';
import { bulkDeleteEnvelopesRoute } from './bulk-delete-envelopes';
import { bulkMoveEnvelopesRoute } from './bulk-move-envelopes';
import { createEnvelopeRoute } from './create-envelope';
import { createEnvelopeItemsRoute } from './create-envelope-items';
import { deleteEnvelopeRoute } from './delete-envelope';
import { deleteEnvelopeItemRoute } from './delete-envelope-item';
import { distributeEnvelopeRoute } from './distribute-envelope';
import { downloadEnvelopeItemRoute } from './download-envelope-item';
import { duplicateEnvelopeRoute } from './duplicate-envelope';
import { createEnvelopeFieldsRoute } from './envelope-fields/create-envelope-fields';
import { deleteEnvelopeFieldRoute } from './envelope-fields/delete-envelope-field';
import { getEnvelopeFieldRoute } from './envelope-fields/get-envelope-field';
import { updateEnvelopeFieldsRoute } from './envelope-fields/update-envelope-fields';
import { createEnvelopeRecipientsRoute } from './envelope-recipients/create-envelope-recipients';
import { deleteEnvelopeRecipientRoute } from './envelope-recipients/delete-envelope-recipient';
import { getEnvelopeRecipientRoute } from './envelope-recipients/get-envelope-recipient';
import { updateEnvelopeRecipientsRoute } from './envelope-recipients/update-envelope-recipients';
import { findEnvelopeAuditLogsRoute } from './find-envelope-audit-logs';
import { findEnvelopesRoute } from './find-envelopes';
import { getEnvelopeRoute } from './get-envelope';
import { getEnvelopeItemsRoute } from './get-envelope-items';
import { getEnvelopeItemsByTokenRoute } from './get-envelope-items-by-token';
import { getEnvelopesByIdsRoute } from './get-envelopes-by-ids';
import { redistributeEnvelopeRoute } from './redistribute-envelope';
import { setEnvelopeFieldsRoute } from './set-envelope-fields';
import { setEnvelopeRecipientsRoute } from './set-envelope-recipients';
import { signEnvelopeFieldRoute } from './sign-envelope-field';
import { getSigningTwoFactorStatusRoute } from './signing-2fa/get-signing-two-factor-status';
import { issueSigningTwoFactorTokenRoute } from './signing-2fa/issue-signing-two-factor-token';
import { verifySigningTwoFactorTokenRoute } from './signing-2fa/verify-signing-two-factor-token';
import { signingStatusEnvelopeRoute } from './signing-status-envelope';
import { updateEnvelopeRoute } from './update-envelope';
import { updateEnvelopeItemsRoute } from './update-envelope-items';
import { useEnvelopeRoute } from './use-envelope';

/**
 * Note: The order of the routes is important for public API routes.
 *
 * Example: GET /envelope/attachment must appear before GET /envelope/:id
 */
export const envelopeRouter = router({
  attachment: {
    find: findAttachmentsRoute,
    create: createAttachmentRoute,
    update: updateAttachmentRoute,
    delete: deleteAttachmentRoute,
  },
  item: {
    getMany: getEnvelopeItemsRoute,
    getManyByToken: getEnvelopeItemsByTokenRoute,
    createMany: createEnvelopeItemsRoute,
    updateMany: updateEnvelopeItemsRoute,
    delete: deleteEnvelopeItemRoute,
    download: downloadEnvelopeItemRoute,
  },
  recipient: {
    get: getEnvelopeRecipientRoute,
    createMany: createEnvelopeRecipientsRoute,
    updateMany: updateEnvelopeRecipientsRoute,
    delete: deleteEnvelopeRecipientRoute,
    set: setEnvelopeRecipientsRoute,
  },
  field: {
    get: getEnvelopeFieldRoute,
    createMany: createEnvelopeFieldsRoute,
    updateMany: updateEnvelopeFieldsRoute,
    delete: deleteEnvelopeFieldRoute,
    set: setEnvelopeFieldsRoute,
    sign: signEnvelopeFieldRoute,
  },
  find: findEnvelopesRoute,
  auditLog: {
    find: findEnvelopeAuditLogsRoute,
  },
  bulk: {
    move: bulkMoveEnvelopesRoute,
    delete: bulkDeleteEnvelopesRoute,
  },
  get: getEnvelopeRoute,
  getMany: getEnvelopesByIdsRoute,
  create: createEnvelopeRoute,
  use: useEnvelopeRoute,
  update: updateEnvelopeRoute,
  delete: deleteEnvelopeRoute,
  duplicate: duplicateEnvelopeRoute,
  distribute: distributeEnvelopeRoute,
  redistribute: redistributeEnvelopeRoute,
  signing2fa: {
    issue: issueSigningTwoFactorTokenRoute,
    verify: verifySigningTwoFactorTokenRoute,
    getStatus: getSigningTwoFactorStatusRoute,
  },
  signingStatus: signingStatusEnvelopeRoute,
});
