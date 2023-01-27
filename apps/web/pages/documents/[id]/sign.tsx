import Head from "next/head";
import { ReactElement } from "react";
import Layout from "../../../components/layout";
import Logo from "../../../components/logo";
import { NextPageWithLayout } from "../../_app";

const SignPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Sign | Documenso</title>
      </Head>
      Hello, please sign at the dotted line.
    </>
  );
};

SignPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default SignPage;
