import { ErrorCode } from "@documenso/lib/auth";
import { verifyPassword } from "@documenso/lib/auth";
import prisma from "@documenso/prisma";
import NextAuth, { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";

export default NextAuth({
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: "/auth/verify-request", // (used for check email message)
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Documenso.com Login",
      type: "credentials",
      credentials: {
        email: {
          label: "Email Address",
          type: "email",
          placeholder: "john.doe@example.com",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Select a password. Here is some inspiration: https://xkcd.com/936/",
        },
      },
      async authorize(credentials: any) {
        if (!credentials) {
          console.error("Credential missing in authorize()");
          throw new Error(ErrorCode.InternalServerError);
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.toLowerCase(),
          },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
          },
        });

        if (!user) {
          throw new Error(ErrorCode.UserNotFound);
        }

        if (!user.password) {
          throw new Error(ErrorCode.UserMissingPassword);
        }

        const isCorrectPassword = await verifyPassword(credentials.password, user.password);

        if (!isCorrectPassword) {
          throw new Error(ErrorCode.IncorrectPassword);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      return {
        ...token,
      };
    },
    async session({ session, token }) {
      const documensoSession: Session = {
        ...session,
        user: {
          ...session.user,
        },
      };

      documensoSession.expires;
      return documensoSession;
    },
  },
});
