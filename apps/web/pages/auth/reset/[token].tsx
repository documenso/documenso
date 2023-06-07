import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import ResetPassword from "../../../components/reset-password";

export default function ResetPasswordPage() {
  return (
    <>
      <Head>
        <title>Reset Password | Documenso</title>
      </Head>
      <ResetPassword />
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
