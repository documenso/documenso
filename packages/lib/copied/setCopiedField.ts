import prisma from "@documenso/prisma";
import { SendStatus } from "@prisma/client";

export const setCopiedField = async (recipient: any) => {
  console.log("@documenso/lib/copied", recipient);

  const copiedUser = await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sendStatus: SendStatus.LINK_COPIED,
    },
  });

  console.log("@documenso/lib/copied", copiedUser);
};
