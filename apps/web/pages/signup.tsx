import { NextPageContext } from "next";
import Head from "next/head";
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
  const signupSource: string = context.query["source"];
  if (process.env.ALLOW_SIGNUP !== "true")
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };

  return {
    props: {
      source: signupSource ? signupSource : "",
    },
  };
}
