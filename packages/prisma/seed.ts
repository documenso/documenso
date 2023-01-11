import prisma from "@documenso/prisma";
import { hashPassword } from "@documenso/lib/auth";
import { IdentityProvider } from "@prisma/client";
import { coloredConsole } from "@documenso/lib";

async function createUser(userData: { email: string; password: string }) {
  try {
    await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        identityProvider: IdentityProvider.DOCUMENSO,
      },
    });
  } catch (error) {
    console.info(
      `WARN: Could not create user "${userData.email}". Maybe the email is already taken?`
    );
  }
}

async function main() {
  await createUser({
    email: "example@documenso.com",
    password: await hashPassword("123456789"),
  });
}

main()
  .then(() => {
    coloredConsole.setupColoredConsole();
    console.log("Finished seeding 🌱");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
