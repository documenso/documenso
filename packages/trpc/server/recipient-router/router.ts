import { router } from '../trpc';
import { completeDocumentWithTokenRoute } from './complete-document-with-token-route';
import { getRecipientRoute } from './get-recipient-route';
import { rejectDocumentWithTokenRoute } from './reject-document-with-token-route';
import { setDocumentRecipientsRoute } from './set-document-recipients-route';
import { setTemplateRecipientsRoute } from './set-template-recipients-route';

export const recipientRouter = router({
  /**
   * Public endpoints.
   */
  getRecipient: getRecipientRoute,
  setDocumentRecipients: setDocumentRecipientsRoute,
  setTemplateRecipients: setTemplateRecipientsRoute,

  /**
   * Private endpoints.
   */
  completeDocumentWithToken: completeDocumentWithTokenRoute,
  rejectDocumentWithToken: rejectDocumentWithTokenRoute,
});
