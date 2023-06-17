import { NextApiRequest, NextApiResponse } from "next";
import { hashPassword } from "@documenso/lib/auth";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { IdentityProvider } from "@prisma/client";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { email, password, source } = req.body;
  const cleanEmail = email.toLowerCase();

  if (!cleanEmail || !/.+@.+/.test(cleanEmail)) {
    res.status(400).json({ message: "Invalid email" });
    return;
  }

  if (!password || password.trim().length < 7) {
    return res.status(400).json({
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

  await prisma.user.upsert({
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
      source: source,
    },
  });

  res.status(201).end();
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
