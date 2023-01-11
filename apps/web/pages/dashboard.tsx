import { useSession } from "next-auth/react";
import Head from "next/head";
import type { ReactElement } from "react";
import Layout from "../components/layout";
import Settings from "../components/settings";
import type { NextPageWithLayout } from "./_app";

const DashboardPage: NextPageWithLayout = () => {
  const status = useSession();
  return (
    <>
      <Head>
        <title>Dashboard | Documenso</title>
      </Head>
      <div>
        <p>This is the dashboard page.</p>
        <div>Mail: {status?.data?.user?.email?.toString()}</div>
        <div>{status.status}</div>
      </div>
    </>
  );
};

// todo layout as component
DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DashboardPage;
