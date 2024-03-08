export const toFriendlyWebhookEventName = (eventName: string) => {
  return eventName.replace(/_/g, '.').toLowerCase();
};
