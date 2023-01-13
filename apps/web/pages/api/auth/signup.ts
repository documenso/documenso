import { IdentityProvider } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";

import prisma from "@documenso/prisma";
import { hashPassword } from "@documenso/lib/auth";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const data = req.body;
  const { email, password } = data;
  const cleanEmail = email.toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    res.status(422).json({ message: "Invalid email" });
    return;
  }

  if (!password || password.trim().length < 7) {
    return res.status(422).json({
      message: "Password should be at least 7 characters long.",
    });
  }

  // User already exists if email already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      email: cleanEmail,
    },
  });

  if (existingUser) {
    const message: string = "This email is already registered.";
    return res.status(409).json({ message });
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: cleanEmail },
    update: {
      password: hashedPassword,
      emailVerified: new Date(Date.now()),
      identityProvider: IdentityProvider.DOCUMENSO,
    },
    create: {
      email: cleanEmail,
      password: hashedPassword,
      identityProvider: IdentityProvider.DOCUMENSO,
    },
  });

  res.status(201).json({ message: "Created user" });
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
