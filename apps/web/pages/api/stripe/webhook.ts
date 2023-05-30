export const config = {
  api: { bodyParser: false },
};

export { webhookHandler as default } from "@documenso/lib/stripe/handlers/webhook";
