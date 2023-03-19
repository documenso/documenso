import Head from "next/head";
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
  const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === "true";

  return {
    props: {
      ALLOW_SIGNUP: ALLOW_SIGNUP,
    },
  };
}
