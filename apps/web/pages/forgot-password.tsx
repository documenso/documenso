import { GetServerSideProps, GetServerSidePropsContext } from "next";
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

export async function getServerSideProps({ req }: GetServerSidePropsContext) {
  const user = await getUserFromToken(req);

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
