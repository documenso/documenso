import { InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Login from "../components/login";

export type LoginPageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

export default function LoginPage({ ALLOW_SIGNUP }: LoginPageProps) {
  return (
    <>
      <Head>
        <title>Login | Documenso</title>
      </Head>
      <Login allowSignup={ALLOW_SIGNUP}></Login>
    </>
  );
}

export async function getServerSideProps() {
  const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === "true";

  return {
    props: {
      ALLOW_SIGNUP: ALLOW_SIGNUP,
    },
  };
}
