import { NextApiRequest, NextApiResponse } from "next";
import { hashPassword } from "@documenso/lib/auth";
import { sendResetPassword } from "@documenso/lib/mail";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { token, password } = req.body;

  if (!token) {
    res.status(422).json({ message: "Invalid token" });
    return;
  }

  const foundToken = await prisma.passwordResetToken.findUnique({
    where: {
      token,
    },
    include: {
      User: true,
    },
  });

  if (!foundToken) {
    return res.status(400).json({ message: "Invalid token." });
  }

  const hashedPassword = await hashPassword(password);

  const transaction = await prisma.$transaction([
    prisma.user.update({
      where: {
        id: foundToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    }),
    prisma.passwordResetToken.delete({
      where: {
        token,
      },
    }),
  ]);

  if (!transaction) {
    return res.status(500).json({ message: "Error resetting password." });
  }

  res.status(200).json({ message: "Password reset successful." });
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
