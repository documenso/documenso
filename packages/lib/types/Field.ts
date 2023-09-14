import { Prisma } from "@prisma/client";

export type FieldWithSignature = Prisma.FieldGetPayload<{
  include: {
    Signature: true
  };
}>;

export type FieldWithRecipient = Prisma.FieldGetPayload<{
  include: {
    Recipient: true
  }
}>;