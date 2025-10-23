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
import { duplicateEnvelopeRoute } from './duplicate-envelope';
import { getEnvelopeRoute } from './get-envelope';
import { redistributeEnvelopeRoute } from './redistribute-envelope';
import { setEnvelopeFieldsRoute } from './set-envelope-fields';
import { setEnvelopeRecipientsRoute } from './set-envelope-recipients';
import { signEnvelopeFieldRoute } from './sign-envelope-field';
import { updateEnvelopeRoute } from './update-envelope';
import { updateEnvelopeItemsRoute } from './update-envelope-items';

export const envelopeRouter = router({
  get: getEnvelopeRoute,
  create: createEnvelopeRoute,
  update: updateEnvelopeRoute,
  delete: deleteEnvelopeRoute,
  duplicate: duplicateEnvelopeRoute,
  distribute: distributeEnvelopeRoute,
  redistribute: redistributeEnvelopeRoute,
  // share: shareEnvelopeRoute,

  item: {
    createMany: createEnvelopeItemsRoute,
    updateMany: updateEnvelopeItemsRoute,
    delete: deleteEnvelopeItemRoute,
  },
  recipient: {
    set: setEnvelopeRecipientsRoute,
  },
  field: {
    set: setEnvelopeFieldsRoute,
    sign: signEnvelopeFieldRoute,
  },
  attachment: {
    find: findAttachmentsRoute,
    create: createAttachmentRoute,
    update: updateAttachmentRoute,
    delete: deleteAttachmentRoute,
  },
});
