/**
 * Stub implementation of the Stripe webhook handler.
 * In the stub version, returns success for all webhook events.
 */

export const stripeWebhookHandler = async (req: Request) => {
  // Simply acknowledge the webhook with success
  return new Response(null, { status: 200 });
};
