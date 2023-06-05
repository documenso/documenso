import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import ResetPassword from "../../components/reset-password";

export default function ResetPasswordPage(props: any) {
  return (
    <>
      <Head>
        <title>Reset Password | Documenso</title>
      </Head>
      <ResetPassword allowSignup={props.ALLOW_SIGNUP}></ResetPassword>
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
