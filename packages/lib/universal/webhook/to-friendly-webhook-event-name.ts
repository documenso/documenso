import { msg } from '@lingui/core/macro';

/**
 * Maps webhook event names to translatable message descriptors
 */
export const WEBHOOK_EVENT_TRANSLATIONS: Record<string, ReturnType<typeof msg>> = {
  DOCUMENT_CREATED: msg`document.created`,
  DOCUMENT_SENT: msg`document.sent`,
  DOCUMENT_OPENED: msg`document.opened`,
  DOCUMENT_SIGNED: msg`document.signed`,
  DOCUMENT_COMPLETED: msg`document.completed`,
  DOCUMENT_REJECTED: msg`document.rejected`,
  DOCUMENT_CANCELLED: msg`document.cancelled`,
};

/**
 * Converts webhook event names to friendly format (e.g., DOCUMENT_CREATED -> document.created)
 * For translated versions, use WEBHOOK_EVENT_TRANSLATIONS with useLingui()
 */
export const toFriendlyWebhookEventName = (eventName: string) => {
  return eventName.replace(/_/g, '.').toLowerCase();
};
