import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import ForgotPassword from "../components/forgot-password";

export default function ForgotPasswordPage(props: any) {
  return (
    <>
      <Head>
        <title>Reset Password | Documenso</title>
      </Head>
      <ForgotPassword allowSignup={props.ALLOW_SIGNUP}></ForgotPassword>
    </>
  );
}

export async function getServerSideProps(context: any) {
  const user = await getUserFromToken(context.req, context.res);
  if (user)
    return {
      redirect: {
        source: "/login",
        destination: "/dashboard",
        permanent: false,
      },
    };

  const ALLOW_SIGNUP = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

  return {
    props: {
      ALLOW_SIGNUP,
    },
  };
}
