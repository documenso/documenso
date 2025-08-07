import { plainClient } from '@documenso/lib/plain/client';
import type { TSupportTicketRequest } from '@documenso/trpc/server/profile-router/schema';

export const submitSupportTicket = async ({ email, subject, message }: TSupportTicketRequest) => {
  const res = await plainClient.createThread({
    title: subject,
    customerIdentifier: { emailAddress: email },
    components: [{ componentText: { text: message } }],
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return res;
};
