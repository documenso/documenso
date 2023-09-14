import { Prisma } from "@prisma/client";

export type DocumentWithRecipient = Prisma.DocumentGetPayload<{
  include: {
    Recipient: true;
  };
}>;

export type DocumentWithRecipientAndField = Prisma.DocumentGetPayload<{
  include: {
    Recipient: true;
    Field: true;
  }
}>;