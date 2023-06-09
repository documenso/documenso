import { NextApiRequest, NextApiResponse } from "next";
import { hashPassword, verifyPassword } from "@documenso/lib/auth";
import { sendResetPasswordSuccessMail } from "@documenso/lib/mail";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { token, password } = req.body;

  if (!token) {
    res.status(400).json({ message: "Invalid token" });
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
    return res.status(404).json({ message: "Invalid token." });
  }

  const now = new Date();

  if (now > foundToken.expiry) {
    return res.status(400).json({ message: "Token has expired" });
  }

  const isSamePassword = await verifyPassword(password, foundToken.User.password!);

  if (isSamePassword) {
    return res.status(400).json({ message: "New password must be different" });
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
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: foundToken.userId,
      },
    }),
  ]);

  if (!transaction) {
    return res.status(500).json({ message: "Error resetting password." });
  }

  await sendResetPasswordSuccessMail(foundToken.User);

  res.status(200).json({ message: "Password reset successful." });
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
