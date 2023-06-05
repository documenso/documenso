import { NextApiRequest, NextApiResponse } from "next";
import { sendResetPassword, sendResetPasswordSuccessMail } from "@documenso/lib/mail";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import crypto from "crypto";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.body;
  const cleanEmail = email.toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    res.status(422).json({ message: "Invalid email" });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "No user found with this email." });
  }

  const token = crypto.randomBytes(64).toString("hex");

  let passwordResetToken;

  try {
    passwordResetToken = await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Error saving token." });
  }

  await sendResetPassword(user, passwordResetToken.token);

  res.status(200).json({ message: "Password reset email sent." });
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
