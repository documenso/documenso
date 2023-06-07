import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import ForgotPassword from "../components/forgot-password";

export default function ForgotPasswordPage() {
  return (
    <>
      <Head>
        <title>Forgot Password | Documenso</title>
      </Head>
      <ForgotPassword />
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

  return {
    props: {},
  };
}
