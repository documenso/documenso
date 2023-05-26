import { NextPageContext } from "next";
import Head from "next/head";
import { getUserFromToken } from "@documenso/lib/server";
import Signup from "../components/signup";

export default function SignupPage(props: { source: string }) {
  return (
    <>
      <Head>
        <title>Signup | Documenso</title>
      </Head>
      <Signup source={props.source}></Signup>
    </>
  );
}

export async function getServerSideProps(context: any) {
  if (process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "true")
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  const user = await getUserFromToken(context.req, context.res);
  if (user)
    return {
      redirect: {
        source: "/signup",
        destination: "/dashboard",
        permanent: false,
      },
    };

  const signupSource: string = context.query["source"];
  return {
    props: {
      source: signupSource ? signupSource : "",
    },
  };
}
