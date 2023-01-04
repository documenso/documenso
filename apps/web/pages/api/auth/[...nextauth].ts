import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export default NextAuth({
  providers: [
    GitHubProvider({
      clientId: "df804870b0d11b0779cf",
      clientSecret: "7ef4bbc0957e48e4e6e59c5b5879b3d75d90acc5",
    }),
  ],
});
