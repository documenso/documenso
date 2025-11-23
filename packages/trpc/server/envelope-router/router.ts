import { router } from '../trpc';
import { createAttachmentRoute } from './attachment/create-attachment';
import { deleteAttachmentRoute } from './attachment/delete-attachment';
import { findAttachmentsRoute } from './attachment/find-attachments';
import { updateAttachmentRoute } from './attachment/update-attachment';
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
import { getEnvelopeRoute } from './get-envelope';
import { getEnvelopeItemsRoute } from './get-envelope-items';
import { getEnvelopeItemsByTokenRoute } from './get-envelope-items-by-token';
import { redistributeEnvelopeRoute } from './redistribute-envelope';
import { setEnvelopeFieldsRoute } from './set-envelope-fields';
import { setEnvelopeRecipientsRoute } from './set-envelope-recipients';
import { signEnvelopeFieldRoute } from './sign-envelope-field';
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
  get: getEnvelopeRoute,
  create: createEnvelopeRoute,
  use: useEnvelopeRoute,
  update: updateEnvelopeRoute,
  delete: deleteEnvelopeRoute,
  duplicate: duplicateEnvelopeRoute,
  distribute: distributeEnvelopeRoute,
  redistribute: redistributeEnvelopeRoute,
  signingStatus: signingStatusEnvelopeRoute,
});
