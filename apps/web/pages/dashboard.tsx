import Head from "next/head";
import type { ReactElement } from "react";
import Layout from "../components/layout";
import Settings from "../components/settings";
import type { NextPageWithLayout } from "./_app";

const DashboardPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Dashboard | Documenso</title>
      </Head>
      <div>
        <p>This is the dashboard page.</p>
      </div>
    </>
  );
};

DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DashboardPage;
