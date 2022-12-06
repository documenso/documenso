import type { ReactElement } from "react";
import Layout from "../components/layout";
import Settings from "../components/settings";
import type { NextPageWithLayout } from "./_app";

const DashboardPage: NextPageWithLayout = () => {
  return <>This is the dashboard page.</>;
};

DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};

export default DashboardPage;
