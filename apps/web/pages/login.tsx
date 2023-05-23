import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import Login from "../components/login";

export default function LoginPage(props: any) {
  return (
    <>
      <Head>
        <title>Login | Documenso</title>
      </Head>
      <Login allowSignup={props.ALLOW_SIGNUP}></Login>
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
