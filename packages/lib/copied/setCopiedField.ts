import prisma from "@documenso/prisma";
import { SendStatus } from "@prisma/client";

export const setCopiedField = async (recipient: any) => {
  return prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sendStatus: SendStatus.LINK_COPIED,
    },
  });
};
